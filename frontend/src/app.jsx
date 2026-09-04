import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PermisosProvider } from './context/PermisosContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ProtectedRoute as ProtectedRouteWithPermiso } from './components/ProtectedRouteWithPermiso';
import { RedirectToFirstAvailable } from './components/RedirectToFirstAvailable';
import Login from './pages/Auth/Login';
import Layout from './components/Layout/Layout';
import Loading from './components/UI/Loading';

const AppLauncher = lazy(() => import('./pages/Home/AppLauncher'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Empleados = lazy(() => import('./pages/Empleados/Empleados'));
const Flota = lazy(() => import('./pages/Flota/Flota'));
const Proveedores = lazy(() => import('./pages/Proveedores/Proveedores'));
const Clientes = lazy(() => import('./pages/Clientes/Clientes'));
const ClienteDetalle = lazy(() => import('./pages/Clientes/ClienteDetalle'));
const SolicitudesCredito = lazy(() => import('./pages/SolicitudesCredito/SolicitudesCredito'));
const Productos = lazy(() => import('./pages/Productos/Productos'));
const ProductoDetalle = lazy(() => import('./pages/Productos/ProductoDetalle'));
const ListaProductosSimple = lazy(() => import('./pages/Productos/ListaProductosSimple'));
const Entradas = lazy(() => import('./pages/Inventario/Entradas'));
const Salidas = lazy(() => import('./pages/Inventario/Salidas'));
const Transferencias = lazy(() => import('./pages/Inventario/Transferencias'));
const StockInventario = lazy(() => import('./pages/Inventario/StockInventario'));
const OrdenesProduccion = lazy(() => import('./pages/Produccion/OrdenesProduccion'));
const OrdenDetalle = lazy(() => import('./pages/Produccion/OrdenDetalle'));
const CrearOrden = lazy(() => import('./pages/Produccion/CrearOrden'));
const CalendarioProduccion = lazy(() => import('./pages/Produccion/CalendarioProduccion'));
const TableroSupervisor = lazy(() => import('./pages/Produccion/TableroSupervisor'));
const Incidencias = lazy(() => import('./pages/Calidad/Incidencias'));
const IncidenciaDetalle = lazy(() => import('./pages/Calidad/IncidenciaDetalle'));
const IncidenciasPorProducto = lazy(() => import('./pages/Calidad/IncidenciasPorProducto'));
const Cotizaciones = lazy(() => import('./pages/Ventas/Cotizaciones'));
const NuevaCotizacion = lazy(() => import('./pages/Ventas/NuevaCotizacion'));
const DetalleCotizacion = lazy(() => import('./pages/Ventas/DetalleCotizacion'));
const ListaPrecios = lazy(() => import('./pages/Ventas/ListaPrecios'));
const OrdenesVenta = lazy(() => import('./pages/Ventas/OrdenesVenta'));
const NuevaOrdenVenta = lazy(() => import('./pages/Ventas/NuevaOrdenVenta'));
const DetalleOrdenVenta = lazy(() => import('./pages/Ventas/DetalleOrdenVenta'));
const VerificarOrdenes = lazy(() => import('./pages/Ventas/VerificarOrdenes'));
const GuiasRemision = lazy(() => import('./pages/Ventas/GuiasRemision'));
const NuevaGuiaRemision = lazy(() => import('./pages/Ventas/NuevaGuiaRemision'));
const DetalleGuiaRemision = lazy(() => import('./pages/Ventas/DetalleGuiaRemision'));
const GuiasTransportista = lazy(() => import('./pages/Ventas/GuiasTransportista'));
const NuevaGuiaTransportista = lazy(() => import('./pages/Ventas/NuevaGuiaTransportista'));
const DetalleGuiaTransportista = lazy(() => import('./pages/Ventas/DetalleGuiaTransportista'));
const ReporteVentas = lazy(() => import('./pages/Ventas/ReporteVentas'));
const SeguimientoVentas = lazy(() => import('./pages/Ventas/SeguimientoVentas'));
const SeguimientoVentaDetalle = lazy(() => import('./pages/Ventas/SeguimientoVentaDetalle'));
const Prospectos = lazy(() => import('./pages/Ventas/Prospectos'));
const Compras = lazy(() => import('./pages/Compras/Compras'));
const NuevaCompra = lazy(() => import('./pages/Compras/NuevaCompra'));
const RegistrarCompraXml = lazy(() => import('./pages/Compras/RegistrarCompraXml'));
const DetalleCompra = lazy(() => import('./pages/Compras/DetalleCompra'));
const CuentasPago = lazy(() => import('./pages/Finanzas/CuentasPago'));
const DetalleCuenta = lazy(() => import('./pages/Finanzas/DetalleCuenta'));
const PagosCobranzas = lazy(() => import('./pages/Finanzas/PagosCobranzas'));
const HistorialTipoCambio = lazy(() => import('./pages/Finanzas/HistorialTipoCambio'));
const ReportesSIRE = lazy(() => import('./pages/Reportes/ReportesSIRE'));
const ReporteProductoDespachos = lazy(() => import('./pages/Reportes/ReporteProductoDespachos'));
const ReporteDeudasClientes = lazy(() => import('./pages/Reportes/ReporteDeudasClientes'));
const MonitorSunat = lazy(() => import('./pages/Reportes/MonitorSunat'));

function App() {
  return (
    <Router>
      <ThemeProvider>
      <AuthProvider>
        <PermisosProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<Loading />}>
                    <Routes>
                      <Route path="/" element={<AppLauncher />} />
                      
                      <Route 
                        path="/dashboard" 
                        element={
                          <ProtectedRouteWithPermiso modulo="dashboard">
                            <Dashboard />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/empleados" 
                        element={
                          <ProtectedRouteWithPermiso modulo="empleados">
                            <Empleados />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/flota" 
                        element={
                          <ProtectedRouteWithPermiso modulo="flota">
                            <Flota />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/proveedores" 
                        element={
                          <ProtectedRouteWithPermiso modulo="proveedores">
                            <Proveedores />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/clientes" 
                        element={
                          <ProtectedRouteWithPermiso modulo="clientes">
                            <Clientes />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/clientes/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="clientes">
                            <ClienteDetalle />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/solicitudes-credito" 
                        element={
                          <ProtectedRouteWithPermiso modulo="solicitudesCredito">
                            <SolicitudesCredito />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route 
                        path="/productos" 
                        element={
                          <ProtectedRouteWithPermiso modulo="productos">
                            <Productos />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/productos/consulta-stock" 
                        element={
                          <ProtectedRouteWithPermiso modulo="consultarStock">
                            <ListaProductosSimple />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route 
                        path="/productos/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="productos">
                            <ProductoDetalle />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/inventario/entradas" 
                        element={
                          <ProtectedRouteWithPermiso modulo="entradas">
                            <Entradas />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/inventario/salidas" 
                        element={
                          <ProtectedRouteWithPermiso modulo="salidas">
                            <Salidas />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/inventario/transferencias" 
                        element={
                          <ProtectedRouteWithPermiso modulo="transferencias">
                            <Transferencias />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/inventario/stock" 
                        element={
                          <ProtectedRouteWithPermiso modulos={['entradas', 'salidas', 'transferencias']}>
                            <StockInventario />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/produccion/ordenes" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesProduccion">
                            <OrdenesProduccion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/produccion/calendario" 
                        element={
                          <ProtectedRouteWithPermiso modulos={['ordenesProduccion', 'cotizaciones']}>
                            <CalendarioProduccion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route 
                        path="/produccion/tablero" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesProduccion" requiredRoles={['Supervisor']}>
                            <TableroSupervisor />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route 
                        path="/produccion/ordenes/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesProduccion">
                            <CrearOrden />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/produccion/ordenes/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesProduccion">
                            <OrdenDetalle />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route
                        path="/calidad/incidencias"
                        element={
                          <ProtectedRouteWithPermiso modulo="incidencias">
                            <Incidencias />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route
                        path="/calidad/incidencias-por-producto"
                        element={
                          <ProtectedRouteWithPermiso modulo="incidencias">
                            <IncidenciasPorProducto />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route
                        path="/calidad/incidencias/:id"
                        element={
                          <ProtectedRouteWithPermiso modulo="incidencias">
                            <IncidenciaDetalle />
                          </ProtectedRouteWithPermiso>
                        }
                      />

                      <Route
                        path="/ventas/prospectos"
                        element={
                          <ProtectedRouteWithPermiso modulo="prospectos" requiredRoles={['Administrador', 'Comercial']}>
                            <Prospectos />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route
                        path="/ventas/cotizaciones"
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <Cotizaciones />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route 
                        path="/ventas/cotizaciones/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <NuevaCotizacion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/cotizaciones/:id/editar" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <NuevaCotizacion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/cotizaciones/:id/duplicar" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <NuevaCotizacion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/cotizaciones/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <DetalleCotizacion />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/listas-precios" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <ListaPrecios />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/ventas/ordenes" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <OrdenesVenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/verificacion"
                        element={
                          <ProtectedRouteWithPermiso modulo="verFinanzasVentas">
                            <VerificarOrdenes />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/nueva"
                        element={
                          <ProtectedRouteWithPermiso modulo="verFinanzasVentas">
                            <NuevaOrdenVenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/:id/editar"
                        element={
                          <ProtectedRouteWithPermiso modulo="verFinanzasVentas">
                            <NuevaOrdenVenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <DetalleOrdenVenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      {/* --- SEGUIMIENTO DE DESPACHOS (Calidad, sin precios) --- */}
                      <Route
                        path="/ventas/seguimiento"
                        element={
                          <ProtectedRouteWithPermiso modulo="seguimientoVentas">
                            <SeguimientoVentas />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route
                        path="/ventas/seguimiento/:id"
                        element={
                          <ProtectedRouteWithPermiso modulo="seguimientoVentas">
                            <SeguimientoVentaDetalle />
                          </ProtectedRouteWithPermiso>
                        }
                      />

                      <Route
                        path="/ventas/guias-remision"
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <GuiasRemision />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route 
                        path="/ventas/guias-remision/nueva"
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <NuevaGuiaRemision />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/guias-remision/:id"
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <DetalleGuiaRemision />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route 
                        path="/ventas/guias-transportista" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasTransportista">
                            <GuiasTransportista />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/guias-transportista/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasTransportista">
                            <NuevaGuiaTransportista />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/guias-transportista/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasTransportista">
                            <DetalleGuiaTransportista />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      {/* --- NUEVA RUTA DE REPORTES VENTAS --- */}
                      <Route 
                        path="/ventas/reportes" 
                        element={
                          <ProtectedRouteWithPermiso modulo="reportes">
                            <ReporteVentas />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/reporte-despachos" 
                        element={
                          <ProtectedRouteWithPermiso modulo="reportes">
                            <ReporteProductoDespachos />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/reporte-deudas" 
                        element={
                          <ProtectedRouteWithPermiso modulo="reportes">
                            <ReporteDeudasClientes />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      {/* ------------------------------------- */}
                      
                      <Route 
                        path="/compras" 
                        element={
                          <ProtectedRouteWithPermiso modulo="compras">
                            <Compras />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/compras/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="compras">
                            <NuevaCompra />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route
                        path="/compras/registrar-xml"
                        element={
                          <ProtectedRouteWithPermiso modulo="compras">
                            <RegistrarCompraXml />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route
                        path="/compras/:id/editar"
                        element={
                          <ProtectedRouteWithPermiso modulo="compras">
                            <NuevaCompra />
                          </ProtectedRouteWithPermiso>
                        }
                      />
                      <Route 
                        path="/compras/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="compras">
                            <DetalleCompra />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route 
                        path="/finanzas/cuentas-pago" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cuentasPago">
                            <CuentasPago />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/finanzas/cuentas/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cuentasPago">
                            <DetalleCuenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/finanzas/pagos-cobranzas" 
                        element={
                          <ProtectedRouteWithPermiso modulo="pagosCobranzas">
                            <PagosCobranzas />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/finanzas/historial-tc" 
                        element={
                          <ProtectedRouteWithPermiso modulo="pagosCobranzas">
                            <HistorialTipoCambio />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route
                        path="/reportes/sire"
                        element={
                          <ProtectedRouteWithPermiso modulo="reportes">
                            <ReportesSIRE />
                          </ProtectedRouteWithPermiso>
                        }
                      />

                      {/* Monitor SUNAT (Fase 15): soporte diario de la emisión electrónica. */}
                      <Route
                        path="/reportes/monitor-sunat"
                        element={
                          <ProtectedRouteWithPermiso modulo="facturacion">
                            <MonitorSunat />
                          </ProtectedRouteWithPermiso>
                        }
                      />

                      <Route path="*" element={<RedirectToFirstAvailable />} />
                    </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </PermisosProvider>
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
