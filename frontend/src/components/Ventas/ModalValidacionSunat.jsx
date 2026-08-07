import React, { useState, useEffect } from 'react';
import { api } from '../../config/api';
import Alert from '../UI/Alert';
import './ModalValidacionSunat.css';

const ModalValidacionSunat = ({ isOpen, onClose, orden, file, onConfirm, readOnly = false, existingData = null, saldoPendiente = null, totalFacturado = 0, idSalida = null, facturas = null, resumen = null, fetchSalidaPDF = null }) => {
    const esFacturacionParcial = Number(totalFacturado) > 0;
    // Monto contra el que se valida: saldo pendiente si ya hay facturas, si no el total de la orden.
    const montoObjetivo = (saldoPendiente !== null && saldoPendiente !== undefined)
        ? Number(saldoPendiente)
        : Number(orden?.total || 0);
    // Formato de moneda para importes/totales: símbolo + separador de miles + 2 decimales.
    const simboloMoneda = orden?.moneda === 'USD' ? '$' : 'S/';
    const fmtMoneda = (v) => `${simboloMoneda} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0))}`;
    const [parsedData, setParsedData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);
    const [formData, setFormData] = useState({
        numero_comprobante_sunat: '',
        fecha_emision: '',
        ruc_cliente: '',
        razon_social: '',
        importe_total: ''
    });
    const [pdfUrl, setPdfUrl] = useState(null);
    // Pestañas por factura (modo visor con múltiples facturas por orden).
    const tieneTabs = readOnly && Array.isArray(facturas) && facturas.length > 0;
    const [tabActiva, setTabActiva] = useState(0);
    useEffect(() => { if (isOpen) setTabActiva(0); }, [isOpen]);

    // Sub-pestañas del visor: alternar entre la Factura y la Guía de Salida (con precios).
    const [vistaDoc, setVistaDoc] = useState('factura');
    const [salidaUrl, setSalidaUrl] = useState(null);
    const [loadingSalida, setLoadingSalida] = useState(false);
    // Al cambiar de factura (pestaña) o abrir/cerrar, se vuelve a la vista de factura.
    useEffect(() => { setVistaDoc('factura'); setSalidaUrl(null); }, [tabActiva, isOpen]);
    // Libera la object-URL de la salida cuando se reemplaza o al desmontar.
    useEffect(() => () => { if (salidaUrl) URL.revokeObjectURL(salidaUrl); }, [salidaUrl]);

    const cargarVerSalida = async (idSal) => {
        if (!idSal || !fetchSalidaPDF) return;
        if (salidaUrl) { setVistaDoc('salida'); return; }
        setLoadingSalida(true);
        try {
            const url = await fetchSalidaPDF(idSal);
            if (url) { setSalidaUrl(url); setVistaDoc('salida'); }
        } catch (e) {
            setAlert({ type: 'error', message: 'No se pudo cargar la guía de salida.' });
        } finally {
            setLoadingSalida(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (readOnly && (tieneTabs || existingData)) {
            // Modo Visor. Con pestañas: usamos la factura activa; sin pestañas: datos de la orden.
            const f = tieneTabs ? facturas[Math.min(tabActiva, facturas.length - 1)] : null;

            setFormData({
                numero_comprobante_sunat: f ? (f.numero_factura || '') : (orden.numero_comprobante_sunat || ''),
                fecha_emision: f
                    ? (f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-PE') : '')
                    : (orden.fecha_facturacion_sunat ? new Date(orden.fecha_facturacion_sunat).toLocaleDateString('es-PE') : ''),
                ruc_cliente: orden?.ruc_cliente || '',
                razon_social: orden?.cliente || '',
                importe_total: f ? (f.total || '') : (orden.total || '')
            });

            // Resolver URL de PDF (puede ser string o array JSON)
            let url = f ? f.url_pdf : orden.comprobante_sunat_url;
            if (url && typeof url === 'string' && url.startsWith('[')) {
                try {
                    const parsed = JSON.parse(url);
                    url = parsed[0];
                } catch (e) { }
            }
            setPdfUrl(url);
            return;
        }

        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPdfUrl(objectUrl);
            parsearPDF(file);
        }

        return () => {
            if (pdfUrl && !readOnly) {
                URL.revokeObjectURL(pdfUrl);
            }
            setParsedData(null);
            setFormData({
                numero_comprobante_sunat: '',
                fecha_emision: '',
                ruc_cliente: '',
                razon_social: '',
                importe_total: ''
            });
            setAlert(null);
            setPdfUrl(null);
        };
        // eslint-disable-next-line
    }, [isOpen, file, readOnly, existingData, tabActiva, facturas]);

    useEffect(() => {
        if (!parsedData || readOnly) return;

        let advertencias = [];
        
        if (!formData.ruc_cliente || !formData.importe_total || !formData.numero_comprobante_sunat) {
            advertencias.push('No se detectaron todos los datos automáticamente. Por favor, complételos o corríjalos manualmente.');
        }

        // Comparar RUC
        if (formData.ruc_cliente && orden?.ruc_cliente && formData.ruc_cliente !== orden.ruc_cliente) {
            advertencias.push(`El RUC (${formData.ruc_cliente}) no coincide con el cliente de la Orden (${orden.ruc_cliente}).`);
        }

        // Comparar Totales (Tolerancia de decimales)
        if (formData.importe_total) {
            const totalPdf = parseFloat(String(formData.importe_total).replace(/,/g, ''));
            if (!isNaN(totalPdf)) {
                if (esFacturacionParcial || idSalida) {
                    // Factura parcial o atada a un despacho: validamos contra el monto objetivo
                    // (saldo pendiente de la orden, o el valor del despacho según corresponda).
                    if (totalPdf > montoObjetivo + 1) {
                        advertencias.push(idSalida
                            ? `El Total (${fmtMoneda(totalPdf)}) excede el valor pendiente de este despacho (${fmtMoneda(montoObjetivo)}).`
                            : `El Total (${fmtMoneda(totalPdf)}) excede el saldo pendiente de facturar (${fmtMoneda(montoObjetivo)}).`);
                    }
                } else if (orden?.total && Math.abs(totalPdf - Number(orden.total)) > 1) {
                    advertencias.push(`El Total (${fmtMoneda(totalPdf)}) difiere del total de la Orden (${fmtMoneda(orden.total)}).`);
                }
            }
        }

        if (advertencias.length > 0) {
            setAlert({ 
                type: 'warning', 
                message: 'Verifique los datos:\n' + advertencias.join('\n') 
            });
        } else {
            setAlert({ type: 'success', message: 'Datos correctos y coinciden con la orden.' });
        }
    }, [formData.ruc_cliente, formData.importe_total, formData.numero_comprobante_sunat, orden, parsedData]);

    const parsearPDF = async (pdfFile) => {
        setLoading(true);
        setAlert(null);
        try {
            const formDataParser = new FormData();
            formDataParser.append('pdf', pdfFile);

            const response = await api.post('/ordenes-venta/parse-sunat', formDataParser, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                const extraido = response.data.data;
                setParsedData(extraido);
                
                // Autocompletar el formulario con lo extraído
                setFormData({
                    numero_comprobante_sunat: extraido?.comprobante?.serie_correlativo || '',
                    fecha_emision: extraido?.comprobante?.fecha_emision || '',
                    ruc_cliente: extraido?.cliente?.ruc || '',
                    razon_social: extraido?.cliente?.razon_social || '',
                    importe_total: extraido?.totales?.importe_total || ''
                });
            } else {
                setAlert({ type: 'error', message: response.data.error || 'Error al leer el PDF' });
            }
        } catch (error) {
            console.error('Error parseando PDF:', error);
            setAlert({ type: 'error', message: 'No se pudo leer el archivo PDF. Intente digitar los datos manualmente o revise el documento.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const enviarVinculacion = async (forzar) => {
        setLoading(true);
        try {
            const formDataSubmit = new FormData();
            formDataSubmit.append('pdf', file);
            formDataSubmit.append('numero_comprobante_sunat', formData.numero_comprobante_sunat);

            if (formData.importe_total) {
                formDataSubmit.append('importe_total', String(formData.importe_total).replace(/,/g, ''));
            }
            if (forzar) {
                formDataSubmit.append('forzar', 'true');
            }
            // Vincular la factura directamente a un despacho concreto (si aplica).
            if (idSalida) {
                formDataSubmit.append('id_salida', idSalida);
            }

            // Convertimos la fecha DD/MM/YYYY a YYYY-MM-DD para MySQL si está presente
            if (formData.fecha_emision) {
                const parts = formData.fecha_emision.split('/');
                if (parts.length === 3) {
                     formDataSubmit.append('fecha_facturacion_sunat', `${parts[2]}-${parts[1]}-${parts[0]} 00:00:00`);
                }
            }

            const response = await api.put(`/ordenes-venta/${orden.id_orden_venta}/vincular-sunat`, formDataSubmit, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.success) {
                onConfirm(response.data.data);
            } else {
                setAlert({ type: 'error', message: response.data.error || 'Error al vincular la factura' });
            }
        } catch (error) {
            // El backend rechaza (409) cuando el total excede el saldo pendiente,
            // o cuando el despacho ya tiene una factura. En ambos casos permitimos forzar.
            if (error?.response?.status === 409 && ['EXCEDE_SALDO', 'EXCEDE_DESPACHO', 'DESPACHO_YA_FACTURADO'].includes(error.response.data?.code)) {
                const confirmar = window.confirm(
                    `${error.response.data.error}\n\n¿Deseas registrar esta factura de todas formas?`
                );
                if (confirmar) {
                    await enviarVinculacion(true);
                    return;
                }
                setAlert({ type: 'warning', message: error.response.data.error });
            } else {
                console.error('Error:', error);
                setAlert({ type: 'error', message: error?.response?.data?.error || 'Error de conexión al guardar los datos.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.numero_comprobante_sunat) {
            setAlert({ type: 'error', message: 'El número de comprobante es obligatorio.' });
            return;
        }

        // Doble validación: Si hay advertencias (vacíos o discrepancias), pedir confirmación
        let forzar = false;
        if (alert && alert.type === 'warning') {
            const confirmar = window.confirm("Cuidado: Hay datos que no coinciden con la orden original o no pudieron ser leídos.\n\n¿Estás seguro de que deseas forzar la vinculación de este documento de todas formas?");
            if (!confirmar) {
                return; // Se cancela la vinculación
            }
            forzar = true;
        }

        await enviarVinculacion(forzar);
    };

    if (!isOpen) return null;

    const facturaActivaModal = tieneTabs ? facturas[Math.min(tabActiva, facturas.length - 1)] : null;
    const salidaActiva = facturaActivaModal?.id_salida || null;
    const puedeVerSalida = !!(salidaActiva && fetchSalidaPDF);
    const subTabStyle = (activo) => ({
        fontSize: '11px', fontWeight: activo ? 700 : 500, padding: '3px 10px', borderRadius: '6px',
        border: activo ? '1px solid #059669' : '1px solid #d1d5db',
        background: activo ? '#ecfdf5' : '#fff', color: activo ? '#047857' : 'var(--text-secondary)', cursor: 'pointer'
    });

    return (
        <div className="modal-sunat-overlay">
            <div className="modal-sunat-content">
                <div className="modal-sunat-header">
                    <h2>{readOnly ? 'Detalle de Factura SUNAT' : 'Vincular Factura SUNAT'}</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>

                {tieneTabs && facturas.length > 1 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                        {facturas.map((f, idx) => (
                            <button
                                key={f.id_factura || idx}
                                type="button"
                                onClick={() => setTabActiva(idx)}
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    fontWeight: idx === tabActiva ? 700 : 500,
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: idx === tabActiva ? '1px solid #059669' : '1px solid #d1d5db',
                                    background: idx === tabActiva ? '#ecfdf5' : '#fff',
                                    color: idx === tabActiva ? '#047857' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                                title={f.id_salida ? `Despacho SAL-${String(f.id_salida).padStart(6, '0')}` : 'Orden completa'}
                            >
                                {f.numero_factura}
                            </button>
                        ))}
                    </div>
                )}

                {readOnly && resumen && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', fontSize: '12px', background: '#fbfbfb' }}>
                        <span>Total orden: <strong>{fmtMoneda(resumen.total_orden)}</strong></span>
                        <span style={{ color: '#047857' }}>Facturado: <strong>{fmtMoneda(resumen.total_facturado)}</strong></span>
                        <span style={{ color: (resumen.saldo_pendiente > 1) ? '#b45309' : '#047857' }}>
                            Pendiente: <strong>{fmtMoneda(resumen.saldo_pendiente)}</strong>
                        </span>
                    </div>
                )}

                {tieneTabs && facturas[Math.min(tabActiva, facturas.length - 1)] && (
                    <div style={{ padding: '6px 16px', fontSize: '12px', color: 'var(--text-secondary)', borderBottom: '1px solid #f0f0f0' }}>
                        Asociada a:{' '}
                        <strong>
                            {facturas[Math.min(tabActiva, facturas.length - 1)].id_salida
                                ? `Despacho SAL-${String(facturas[Math.min(tabActiva, facturas.length - 1)].id_salida).padStart(6, '0')}`
                                : 'Orden completa'}
                        </strong>
                    </div>
                )}

                <div className="modal-sunat-body">
                    {/* Panel Izquierdo: Formulario de Datos Extraídos */}
                    <div className="sunat-panel-izquierdo">
                        <h3>{readOnly ? 'Datos Registrados' : 'Datos Extraídos'}</h3>
                        {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
                        
                        <form onSubmit={handleSubmit} className="sunat-form">
                            <div className="form-group">
                                <label>Número de Comprobante (Serie - Correlativo):</label>
                                <input 
                                    type="text" 
                                    name="numero_comprobante_sunat" 
                                    value={formData.numero_comprobante_sunat} 
                                    onChange={handleChange}
                                    placeholder="Ej: F001-000123"
                                    required
                                    readOnly={readOnly}
                                    className={!formData.numero_comprobante_sunat && !loading && !readOnly ? 'input-error' : (readOnly ? 'input-readonly' : '')}
                                />
                                {!readOnly && <small>Requerido. Verifique que coincida con el documento.</small>}
                            </div>

                            <div className="form-group">
                                <label>Fecha de Emisión:</label>
                                <input 
                                    type="text" 
                                    name="fecha_emision" 
                                    value={formData.fecha_emision} 
                                    onChange={handleChange}
                                    placeholder="DD/MM/YYYY"
                                    readOnly={readOnly}
                                    className={readOnly ? 'input-readonly' : ''}
                                />
                            </div>

                            <hr className="sunat-divider" />
                            <h4>Datos del Cliente</h4>
                            
                            <div className="form-group">
                                <label>RUC:</label>
                                <input 
                                    type="text" 
                                    name="ruc_cliente"
                                    value={formData.ruc_cliente} 
                                    onChange={handleChange}
                                    readOnly={readOnly}
                                    className={readOnly ? 'input-readonly' : ''}
                                />
                                <small>RUC en la Orden: {orden?.ruc_cliente}</small>
                            </div>

                            <div className="form-group">
                                <label>Total:</label>
                                <input 
                                    type="text" 
                                    name="importe_total"
                                    value={formData.importe_total} 
                                    onChange={handleChange}
                                    readOnly={readOnly}
                                    className={readOnly ? 'input-readonly' : ''}
                                />
                                {idSalida ? (
                                    <small>
                                        <strong>Valor pendiente del despacho: {fmtMoneda(montoObjetivo)}</strong>
                                        {Number(totalFacturado) > 0 && <> · Ya facturado en el despacho: {fmtMoneda(totalFacturado)}</>}
                                    </small>
                                ) : esFacturacionParcial ? (
                                    <small>
                                        Ya facturado: {fmtMoneda(totalFacturado)} · <strong>Saldo pendiente: {fmtMoneda(montoObjetivo)}</strong> (Total orden: {fmtMoneda(orden?.total)})
                                    </small>
                                ) : (
                                    <small>Total en la Orden: {fmtMoneda(orden?.total)}</small>
                                )}
                            </div>

                            <div className="sunat-form-actions">
                                {readOnly ? (
                                    <button type="button" className="btn btn-primary" onClick={onClose}>
                                        Cerrar
                                    </button>
                                ) : (
                                    <>
                                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                                            Cancelar
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Guardando...' : 'Confirmar y Vincular'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Panel Derecho: Visor de PDF (con sub-pestañas Factura / Guía de salida) */}
                    <div className="sunat-panel-derecho">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <h3 style={{ margin: 0 }}>Vista del Documento</h3>
                            {puedeVerSalida && (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button type="button" style={subTabStyle(vistaDoc === 'factura')} onClick={() => setVistaDoc('factura')}>
                                        Factura
                                    </button>
                                    <button type="button" style={subTabStyle(vistaDoc === 'salida')} onClick={() => cargarVerSalida(salidaActiva)} disabled={loadingSalida}>
                                        {loadingSalida ? 'Cargando…' : 'Guía de salida'}
                                    </button>
                                </div>
                            )}
                        </div>
                        {(() => {
                            const urlMostrar = vistaDoc === 'salida' ? salidaUrl : pdfUrl;
                            return urlMostrar ? (
                                <iframe
                                    src={urlMostrar}
                                    title={vistaDoc === 'salida' ? 'Guía de Salida valorizada' : 'Visor PDF SUNAT'}
                                    className="sunat-pdf-viewer"
                                />
                            ) : (
                                <div className="sunat-pdf-placeholder">
                                    {loadingSalida ? 'Cargando guía de salida…' : 'Cargando documento...'}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalValidacionSunat;