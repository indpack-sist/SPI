import axios from 'axios';

const API_APISPERU_TOKEN = process.env.API_APISPERU_TOKEN || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImphaW1leXh2QGdtYWlsLmNvbSJ9.waHiFXmUg9CCjuWAXsVaG8nFgN-6KIj_k9zgVA6ZJ24';
const API_TIMEOUT = 10000;

export async function validarDNI(dni) {
  try {
    if (!dni || !/^\d{8}$/.test(dni)) {
      return {
        valido: false,
        error: 'DNI debe tener 8 dígitos numéricos'
      };
    }

    console.log(`Validando DNI: ${dni} con APISPeru...`);

    const response = await axios.get(
      `https://dniruc.apisperu.com/api/v1/dni/${dni}`,
      {
        params: {
          token: API_APISPERU_TOKEN
        },
        timeout: API_TIMEOUT
      }
    );

    console.log('Respuesta de APISPeru:', response.data);

    if (response.data && response.data.success === false) {
      return {
        valido: false,
        error: response.data.message || 'DNI no encontrado en RENIEC'
      };
    }

    if (response.data && response.data.dni) {
      return {
        valido: true,
        datos: {
          dni: response.data.dni,
          nombres: response.data.nombres,
          apellido_paterno: response.data.apellidoPaterno,
          apellido_materno: response.data.apellidoMaterno,
          nombre_completo: `${response.data.nombres} ${response.data.apellidoPaterno} ${response.data.apellidoMaterno}`
        }
      };
    }

    return {
      valido: false,
      error: 'No se pudieron obtener datos del DNI'
    };

  } catch (error) {
    console.error('Error al validar DNI:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 404) {
      return {
        valido: false,
        error: 'DNI no encontrado en RENIEC'
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        valido: true,
        datos: null,
        advertencia: 'Timeout en servicio de validación. Solo validación de formato.',
        error_servicio: true
      };
    }
    
    return {
      valido: true,
      datos: null,
      advertencia: 'Servicio de validación DNI temporalmente no disponible. Solo validación de formato.',
      error_servicio: true
    };
  }
}

export async function validarRUC(ruc) {
  try {
    if (!ruc || !/^\d{11}$/.test(ruc)) {
      return {
        valido: false,
        error: 'RUC debe tener 11 dígitos numéricos'
      };
    }

    console.log(`Validando RUC: ${ruc} con APISPeru...`);

    const response = await axios.get(
      `https://dniruc.apisperu.com/api/v1/ruc/${ruc}`,
      {
        params: {
          token: API_APISPERU_TOKEN
        },
        timeout: API_TIMEOUT
      }
    );

    console.log('Respuesta de APISPeru:', response.data);

    if (response.data && response.data.success === false) {
      return {
        valido: false,
        error: response.data.message || 'RUC no encontrado en SUNAT'
      };
    }

    if (response.data && response.data.ruc) {
      return {
        valido: true,
        datos: {
          ruc: response.data.ruc,
          razon_social: response.data.razonSocial,
          nombre_comercial: response.data.nombreComercial || null,
          tipo_contribuyente: response.data.tipoContribuyente || null,
          estado: response.data.estado || null,
          condicion: response.data.condicion || null,
          direccion: response.data.direccion || null,
          departamento: response.data.departamento || null,
          provincia: response.data.provincia || null,
          distrito: response.data.distrito || null,
          ubigeo: response.data.ubigeo || null,
          es_habido: (response.data.condicion || '').toLowerCase() === 'habido',
          es_activo: (response.data.estado || '').toLowerCase() === 'activo'
        }
      };
    }

    return {
      valido: false,
      error: 'No se pudieron obtener datos del RUC'
    };

  } catch (error) {
    console.error('Error al validar RUC:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 404) {
      return {
        valido: false,
        error: 'RUC no encontrado en SUNAT'
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        valido: true,
        datos: null,
        advertencia: 'Timeout en servicio de validación. Solo validación de formato.',
        error_servicio: true
      };
    }
    
    return {
      valido: true,
      datos: null,
      advertencia: 'Servicio de validación RUC temporalmente no disponible. Solo validación de formato.',
      error_servicio: true
    };
  }
}