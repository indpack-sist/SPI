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