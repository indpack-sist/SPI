import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Auth/Login';
import Layout from './components/Layout/Layout';

// Dashboard
import Dashboard from "./pages/Dashboard/Dashboard";

// Maestros
import Empleados from './pages/Empleados/Empleados';
import Flota from './pages/Flota/Flota';
import Proveedores from './pages/Proveedores/Proveedores';
import Clientes from './pages/Clientes/Clientes';

// Productos
import Productos from './pages/Productos/Productos';
import ProductoDetalle from './pages/Productos/ProductoDetalle';

// Inventario
import Entradas from './pages/Inventario/Entradas';
import Salidas from './pages/Inventario/Salidas';
import Transferencias from './pages/Inventario/Transferencias';
import StockInventario from './pages/Inventario/StockInventario';

// Producción
import OrdenesProduccion from './pages/Produccion/OrdenesProduccion';
import OrdenDetalle from './pages/Produccion/OrdenDetalle';
import CrearOrden from './pages/Produccion/CrearOrden';

// Ventas
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

// Compras
import OrdenesCompra from './pages/Compras/OrdenesCompra';
import NuevaOrdenCompra from './pages/Compras/NuevaOrdenCompra';
import DetalleOrdenCompra from './pages/Compras/DetalleOrdenCompra';
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* ==========================================
              RUTA PÚBLICA - LOGIN
              ========================================== */}
          <Route path="/login" element={<Login />} />

          {/* ==========================================
              RUTAS PROTEGIDAS - REQUIEREN LOGIN
              ========================================== */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    {/* Dashboard */}
                    <Route path="/" element={<Dashboard />} />
                    
                    {/* Módulos Maestros */}
                    <Route path="/empleados" element={<Empleados />} />
                    <Route path="/flota" element={<Flota />} />
                    <Route path="/proveedores" element={<Proveedores />} />
                    <Route path="/clientes" element={<Clientes />} />
                    
                    {/* Productos */}
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/productos/:id" element={<ProductoDetalle />} />
                    
                    {/* Inventario */}
                    <Route path="/inventario/entradas" element={<Entradas />} />
                    <Route path="/inventario/salidas" element={<Salidas />} />
                    <Route path="/inventario/transferencias" element={<Transferencias />} />
                    <Route path="/inventario/stock" element={<StockInventario />} />
                    
                    {/* Producción */}
                    <Route path="/produccion/ordenes" element={<OrdenesProduccion />} />
                    <Route path="/produccion/ordenes/nueva" element={<CrearOrden />} />
                    <Route path="/produccion/ordenes/:id" element={<OrdenDetalle />} />
                    
                    {/* Ventas - Cotizaciones */}
                    <Route path="/ventas/cotizaciones" element={<Cotizaciones />} />
                    <Route path="/ventas/cotizaciones/nueva" element={<NuevaCotizacion />} />
                    <Route path="/ventas/cotizaciones/:id" element={<DetalleCotizacion />} />
                    
                    {/* Ventas - Órdenes de Venta */}
                    <Route path="/ventas/ordenes" element={<OrdenesVenta />} />
                    <Route path="/ventas/ordenes/nueva" element={<NuevaOrdenVenta />} />
                    <Route path="/ventas/ordenes/:id" element={<DetalleOrdenVenta />} />
                    
                    {/* Ventas - Guías de Remisión */}
                    <Route path="/ventas/guias-remision" element={<GuiasRemision />} />
                    <Route path="/ventas/guias-remision/nueva" element={<NuevaGuiaRemision />} />
                    <Route path="/ventas/guias-remision/:id" element={<DetalleGuiaRemision />} />
                    
                    {/* Ventas - Guías de Transportista */}
                    <Route path="/ventas/guias-transportista" element={<GuiasTransportista />} />
                    <Route path="/ventas/guias-transportista/nueva" element={<NuevaGuiaTransportista />} />
                    <Route path="/ventas/guias-transportista/:id" element={<DetalleGuiaTransportista />} />
                    
                    {/* Compras - Órdenes de Compra */}
                    <Route path="/compras/ordenes" element={<OrdenesCompra />} />
                    <Route path="/compras/ordenes/nueva" element={<NuevaOrdenCompra />} />
                    <Route path="/compras/ordenes/:id" element={<DetalleOrdenCompra />} />
                    
                    {/* Redirect por defecto */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;