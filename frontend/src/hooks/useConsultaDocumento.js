import { useRef, useState } from 'react';
import { guiasRemisionAPI } from '../config/api';

function estadoRuc(datos) {
  const baja = datos.estado && !datos.es_activo;
  const noHabido = datos.condicion && !datos.es_habido;
  if (baja || noHabido) {
    return { tipo: 'aviso', mensaje: `Atención: SUNAT lo registra como ${[datos.estado, datos.condicion].filter(Boolean).join(' · ')}` };
  }
  return { tipo: 'ok', mensaje: 'Razón social según SUNAT' };
}

export default function useConsultaDocumento() {
  const [estados, setEstados] = useState({});
  const vigente = useRef({});

  const limpiar = (campo) => {
    if (campo === undefined) {
      vigente.current = {};
      setEstados({});
      return;
    }
    vigente.current[campo] = null;
    setEstados((prev) => ({ ...prev, [campo]: null }));
  };

  const consultar = async (campo, documento, peticion, aplicar, estadoExito) => {
    vigente.current[campo] = documento;
    setEstados((prev) => ({ ...prev, [campo]: { tipo: 'cargando', mensaje: 'Consultando…' } }));
    try {
      const { data } = await peticion(documento);
      if (vigente.current[campo] !== documento) return;
      aplicar(data.data);
      setEstados((prev) => ({ ...prev, [campo]: estadoExito(data.data) }));
    } catch (err) {
      if (vigente.current[campo] !== documento) return;
      const mensaje = err.response?.data?.error || 'No se pudo consultar el documento. Complétalo a mano.';
      setEstados((prev) => ({ ...prev, [campo]: { tipo: 'error', mensaje } }));
    }
  };

  const ruc = (campo, valor, aplicar) => {
    if (valor.length !== 11) return limpiar(campo);
    return consultar(campo, valor, guiasRemisionAPI.consultarRuc, aplicar, estadoRuc);
  };

  const dni = (campo, valor, aplicar) => {
    if (valor.length !== 8) return limpiar(campo);
    return consultar(campo, valor, guiasRemisionAPI.consultarDni, aplicar, () => ({ tipo: 'ok', mensaje: 'Apellidos y nombres según RENIEC' }));
  };

  return { estados, ruc, dni, limpiar };
}
