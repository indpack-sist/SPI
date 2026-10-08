import { executeQuery } from '../config/database.js';

export const ESTADOS_ATENCION = ['Despachada', 'Despacho Parcial', 'Entregada'];

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

export async function empleadoRestringido(idEmpleado) {
  if (!idEmpleado) return false;
  const empleado = await executeQuery(
    'SELECT restringir_clientes FROM empleados WHERE id_empleado = ?',
    [idEmpleado]
  );
  return empleado.success && empleado.data.length > 0 && Number(empleado.data[0].restringir_clientes) === 1;
}
