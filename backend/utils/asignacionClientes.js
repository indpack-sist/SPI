import { executeQuery } from '../config/database.js';

// Estados de orden de venta que cuentan como "atencion" a un cliente.
export const ESTADOS_ATENCION = ['Despachada', 'Despacho Parcial', 'Entregada'];

/**
 * Determina si un empleado puede atender (crear cotizaciones/ordenes) a un cliente.
 * - Si el empleado no esta restringido (restringir_clientes = 0) -> siempre permitido.
 * - Si esta restringido -> solo si el cliente esta en su cartera asignada.
 *
 * @param {number} idEmpleado
 * @param {number} idCliente
 * @returns {Promise<boolean>}
 */
export async function clientePermitido(idEmpleado, idCliente) {
  if (!idEmpleado || !idCliente) return true;

  const empleado = await executeQuery(
    'SELECT restringir_clientes FROM empleados WHERE id_empleado = ?',
    [idEmpleado]
  );

  if (!empleado.success || empleado.data.length === 0) return true;
  if (Number(empleado.data[0].restringir_clientes) !== 1) return true;

  const asignado = await executeQuery(
    'SELECT 1 FROM empleado_clientes_asignados WHERE id_empleado = ? AND id_cliente = ? LIMIT 1',
    [idEmpleado, idCliente]
  );

  return asignado.success && asignado.data.length > 0;
}

/**
 * Indica si el empleado tiene activada la restriccion de cartera.
 * @param {number} idEmpleado
 * @returns {Promise<boolean>}
 */
export async function empleadoRestringido(idEmpleado) {
  if (!idEmpleado) return false;
  const empleado = await executeQuery(
    'SELECT restringir_clientes FROM empleados WHERE id_empleado = ?',
    [idEmpleado]
  );
  return empleado.success && empleado.data.length > 0 && Number(empleado.data[0].restringir_clientes) === 1;
}
