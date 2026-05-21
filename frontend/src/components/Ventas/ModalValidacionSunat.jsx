import React, { useState, useEffect } from 'react';
import { api } from '../../config/api';
import Alert from '../UI/Alert';
import './ModalValidacionSunat.css';

const ModalValidacionSunat = ({ isOpen, onClose, orden, file, onConfirm }) => {
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

    useEffect(() => {
        if (isOpen && file) {
            const objectUrl = URL.createObjectURL(file);
            setPdfUrl(objectUrl);
            parsearPDF(file);
        }

        return () => {
            if (pdfUrl) {
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
        };
        // eslint-disable-next-line
    }, [isOpen, file]);

    useEffect(() => {
        if (!parsedData) return;

        let advertencias = [];
        
        if (!formData.ruc_cliente || !formData.importe_total || !formData.numero_comprobante_sunat) {
            advertencias.push('No se detectaron todos los datos automáticamente. Por favor, complételos o corríjalos manualmente.');
        }

        // Comparar RUC
        if (formData.ruc_cliente && orden?.ruc_cliente && formData.ruc_cliente !== orden.ruc_cliente) {
            advertencias.push(`El RUC (${formData.ruc_cliente}) no coincide con el cliente de la Orden (${orden.ruc_cliente}).`);
        }

        // Comparar Totales (Tolerancia de decimales)
        if (formData.importe_total && orden?.total) {
            const totalPdf = parseFloat(String(formData.importe_total).replace(/,/g, ''));
            const totalOrden = parseFloat(orden.total);
            if (!isNaN(totalPdf) && Math.abs(totalPdf - totalOrden) > 1) { // 1 sol/dolar de tolerancia
                advertencias.push(`El Total (${totalPdf}) difiere del total de la Orden (${totalOrden}).`);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.numero_comprobante_sunat) {
            setAlert({ type: 'error', message: 'El número de comprobante es obligatorio.' });
            return;
        }

        setLoading(true);
        try {
            const formDataSubmit = new FormData();
            formDataSubmit.append('pdf', file);
            formDataSubmit.append('numero_comprobante_sunat', formData.numero_comprobante_sunat);
            
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
            console.error('Error:', error);
            setAlert({ type: 'error', message: 'Error de conexión al guardar los datos.' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-sunat-overlay">
            <div className="modal-sunat-content">
                <div className="modal-sunat-header">
                    <h2>Vincular Factura SUNAT</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>
                
                <div className="modal-sunat-body">
                    {/* Panel Izquierdo: Formulario de Datos Extraídos */}
                    <div className="sunat-panel-izquierdo">
                        <h3>Datos Extraídos</h3>
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
                                    className={!formData.numero_comprobante_sunat && !loading ? 'input-error' : ''}
                                />
                                <small>Requerido. Verifique que coincida con el documento.</small>
                            </div>

                            <div className="form-group">
                                <label>Fecha de Emisión (Lectura):</label>
                                <input 
                                    type="text" 
                                    name="fecha_emision" 
                                    value={formData.fecha_emision} 
                                    onChange={handleChange}
                                    placeholder="DD/MM/YYYY"
                                />
                            </div>

                            <hr className="sunat-divider" />
                            <h4>Validación del Cliente</h4>
                            
                            <div className="form-group">
                                <label>RUC (Extraído del PDF):</label>
                                <input 
                                    type="text" 
                                    name="ruc_cliente"
                                    value={formData.ruc_cliente} 
                                    onChange={handleChange}
                                />
                                <small>RUC en la Orden: {orden?.ruc_cliente}</small>
                            </div>

                            <div className="form-group">
                                <label>Total (Extraído del PDF):</label>
                                <input 
                                    type="text" 
                                    name="importe_total"
                                    value={formData.importe_total} 
                                    onChange={handleChange}
                                />
                                <small>Total en la Orden: {orden?.total}</small>
                            </div>

                            <div className="sunat-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Guardando...' : 'Confirmar y Vincular'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Panel Derecho: Visor de PDF */}
                    <div className="sunat-panel-derecho">
                        <h3>Vista del Documento</h3>
                        {pdfUrl ? (
                            <iframe 
                                src={pdfUrl} 
                                title="Visor PDF SUNAT" 
                                className="sunat-pdf-viewer"
                            />
                        ) : (
                            <div className="sunat-pdf-placeholder">Cargando documento...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalValidacionSunat;