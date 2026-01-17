import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { comprasAPI } from '../../config/api';
import { Clock, AlertCircle, XCircle } from 'lucide-react';

export function useNotificacionesCompras() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargarNotificaciones = async () => {
    try {
      setLoading(true);
      const [alertasRes, comprasRes] = await Promise.all([
        comprasAPI.getAlertas(),
        comprasAPI.getAll({ estado_pago: 'Pendiente,Parcial' })
      ]);

      const notifs = [];

      if (alertasRes.data.success) {
        const alertas = alertasRes.data.data;

        if (alertas.cuotas_vencidas?.cantidad > 0) {
          notifs.push({
            id: 'cuotas-vencidas',
            titulo: 'Cuotas Vencidas',
            mensaje: `${alertas.cuotas_vencidas.cantidad} cuota(s) vencida(s) - ${formatMonto(alertas.cuotas_vencidas.monto_total)}`,
            tipo: 'danger',
            icono: XCircle,
            link: '/compras?alertas=vencidas'
          });
        }

        if (alertas.cuotas_proximas_vencer?.cantidad > 0) {
          notifs.push({
            id: 'cuotas-proximas',
            titulo: 'Cuotas Próximas a Vencer',
            mensaje: `${alertas.cuotas_proximas_vencer.cantidad} cuota(s) vencen en 7 días - ${formatMonto(alertas.cuotas_proximas_vencer.monto_total)}`,
            tipo: 'warning',
            icono: Clock,
            link: '/compras?alertas=proximas_vencer'
          });
        }

        if (alertas.compras_vencidas?.cantidad > 0) {
          notifs.push({
            id: 'compras-vencidas',
            titulo: 'Compras Vencidas',
            mensaje: `${alertas.compras_vencidas.cantidad} compra(s) vencida(s)`,
            tipo: 'danger',
            icono: XCircle,
            link: '/compras?alertas=vencidas'
          });
        }
      }

      if (comprasRes.data.success) {
        const comprasPendientes = comprasRes.data.data || [];
        comprasPendientes.slice(0, 3).forEach(compra => {
          if (compra.dias_para_vencer !== null && compra.dias_para_vencer <= 7) {
            notifs.push({
              id: `compra-${compra.id_orden_compra}`,
              titulo: `Compra ${compra.numero_orden}`,
              mensaje: `${compra.proveedor} - Vence en ${compra.dias_para_vencer} días`,
              tipo: compra.dias_para_vencer < 0 ? 'danger' : 'warning',
              icono: compra.dias_para_vencer < 0 ? XCircle : AlertCircle,
              link: `/compras/${compra.id_orden_compra}`
            });
          }
        });
      }

      setNotificaciones(notifs);
    } catch (error) {
      console.error('Error al cargar notificaciones de compras:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMonto = (valor) => {
    return `S/ ${parseFloat(valor || 0).toFixed(2)}`;
  };

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 180000);
    return () => clearInterval(interval);
  }, []);

  return { notificaciones, loading, recargar: cargarNotificaciones };
}