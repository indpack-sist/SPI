import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PermisosProvider } from './context/PermisosContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ProtectedRoute as ProtectedRouteWithPermiso } from './components/ProtectedRouteWithPermiso';
import { RedirectToFirstAvailable } from './components/RedirectToFirstAvailable';
import Login from './pages/Auth/Login';
import Layout from './components/Layout/Layout';
import AppLauncher from './pages/Home/AppLauncher';

import Dashboard from './pages/Dashboard/Dashboard';

import Empleados from './pages/Empleados/Empleados';
import Flota from './pages/Flota/Flota';
import Proveedores from './pages/Proveedores/Proveedores';
import Clientes from './pages/Clientes/Clientes';
import ClienteDetalle from './pages/Clientes/ClienteDetalle';
import SolicitudesCredito from './pages/SolicitudesCredito/SolicitudesCredito';

import Productos from './pages/Productos/Productos';
import ProductoDetalle from './pages/Productos/ProductoDetalle';
import ListaProductosSimple from './pages/Productos/ListaProductosSimple';

import Entradas from './pages/Inventario/Entradas';
import Salidas from './pages/Inventario/Salidas';
import Transferencias from './pages/Inventario/Transferencias';
import StockInventario from './pages/Inventario/StockInventario';

import OrdenesProduccion from './pages/Produccion/OrdenesProduccion';
import OrdenDetalle from './pages/Produccion/OrdenDetalle';
import CrearOrden from './pages/Produccion/CrearOrden';
import CalendarioProduccion from './pages/Produccion/CalendarioProduccion';

import Cotizaciones from './pages/Ventas/Cotizaciones';
import NuevaCotizacion from './pages/Ventas/NuevaCotizacion';
import DetalleCotizacion from './pages/Ventas/DetalleCotizacion';
import ListaPrecios from './pages/Ventas/ListaPrecios';
import OrdenesVenta from './pages/Ventas/OrdenesVenta';
import NuevaOrdenVenta from './pages/Ventas/NuevaOrdenVenta';
import DetalleOrdenVenta from './pages/Ventas/DetalleOrdenVenta';
import VerificarOrdenes from './pages/Ventas/VerificarOrdenes';
import GuiasRemision from './pages/Ventas/GuiasRemision';
import NuevaGuiaRemision from './pages/Ventas/NuevaGuiaRemision';
import DetalleGuiaRemision from './pages/Ventas/DetalleGuiaRemision';
import GuiasTransportista from './pages/Ventas/GuiasTransportista';
import NuevaGuiaTransportista from './pages/Ventas/NuevaGuiaTransportista';
import DetalleGuiaTransportista from './pages/Ventas/DetalleGuiaTransportista';
import ReporteVentas from './pages/Ventas/ReporteVentas'; // <--- NUEVO IMPORT

import Compras from './pages/Compras/Compras';
import NuevaCompra from './pages/Compras/NuevaCompra';
import DetalleCompra from './pages/Compras/DetalleCompra';

import CuentasPago from './pages/Finanzas/CuentasPago';
import DetalleCuenta from './pages/Finanzas/DetalleCuenta';
import PagosCobranzas from './pages/Finanzas/PagosCobranzas';

import ReportesSIRE from './pages/Reportes/ReportesSIRE';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PermisosProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
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
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <VerificarOrdenes />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
                            <NuevaOrdenVenta />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/ordenes/:id/editar" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesVenta">
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
                      
                      <Route 
                        path="/ventas/guias-remision" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasRemision">
                            <GuiasRemision />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/guias-remision/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasRemision">
                            <NuevaGuiaRemision />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/ventas/guias-remision/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="guiasRemision">
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
                        path="/reportes/sire" 
                        element={
                          <ProtectedRouteWithPermiso modulo="reportes">
                            <ReportesSIRE />
                          </ProtectedRouteWithPermiso>
                        } 
                      />

                      <Route path="*" element={<RedirectToFirstAvailable />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </PermisosProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;