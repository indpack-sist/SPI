import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PermisosProvider } from './context/PermisosContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ProtectedRoute as ProtectedRouteWithPermiso } from './components/ProtectedRouteWithPermiso';
import Login from './pages/Auth/Login';
import Layout from './components/Layout/Layout';

import Dashboard from "./pages/Dashboard/Dashboard";

import Empleados from './pages/Empleados/Empleados';
import Flota from './pages/Flota/Flota';
import Proveedores from './pages/Proveedores/Proveedores';
import Clientes from './pages/Clientes/Clientes';

import Productos from './pages/Productos/Productos';
import ProductoDetalle from './pages/Productos/ProductoDetalle';
//test
import Entradas from './pages/Inventario/Entradas';
import Salidas from './pages/Inventario/Salidas';
import Transferencias from './pages/Inventario/Transferencias';
import StockInventario from './pages/Inventario/StockInventario';

import OrdenesProduccion from './pages/Produccion/OrdenesProduccion';
import OrdenDetalle from './pages/Produccion/OrdenDetalle';
import CrearOrden from './pages/Produccion/CrearOrden';

import Cotizaciones from './pages/Ventas/Cotizaciones';
import NuevaCotizacion from './pages/Ventas/NuevaCotizacion';
import DetalleCotizacion from './pages/Ventas/DetalleCotizacion';
import OrdenesVenta from './pages/Ventas/OrdenesVenta';
import NuevaOrdenVenta from './pages/Ventas/NuevaOrdenVenta';
import DetalleOrdenVenta from './pages/Ventas/DetalleOrdenVenta';
import GuiasRemision from './pages/Ventas/GuiasRemision';
import NuevaGuiaRemision from './pages/Ventas/NuevaGuiaRemision';
import DetalleGuiaRemision from './pages/Ventas/DetalleGuiaRemision';
import GuiasTransportista from './pages/Ventas/GuiasTransportista';
import NuevaGuiaTransportista from './pages/Ventas/NuevaGuiaTransportista';
import DetalleGuiaTransportista from './pages/Ventas/DetalleGuiaTransportista';

import OrdenesCompra from './pages/Compras/OrdenesCompra';
import NuevaOrdenCompra from './pages/Compras/NuevaOrdenCompra';
import DetalleOrdenCompra from './pages/Compras/DetalleOrdenCompra';

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
                      <Route 
                        path="/" 
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
                        path="/productos" 
                        element={
                          <ProtectedRouteWithPermiso modulo="productos">
                            <Productos />
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
                        path="/ventas/cotizaciones/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="cotizaciones">
                            <DetalleCotizacion />
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
                        path="/ventas/ordenes/nueva" 
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
                      
                      <Route 
                        path="/compras/ordenes" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesCompra">
                            <OrdenesCompra />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/compras/ordenes/nueva" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesCompra">
                            <NuevaOrdenCompra />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      <Route 
                        path="/compras/ordenes/:id" 
                        element={
                          <ProtectedRouteWithPermiso modulo="ordenesCompra">
                            <DetalleOrdenCompra />
                          </ProtectedRouteWithPermiso>
                        } 
                      />
                      
                      <Route path="*" element={<Navigate to="/" replace />} />
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