import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Users, Truck, Building2, UserCircle2, 
  Package, BarChart3, ArrowDownToLine, ArrowUpFromLine, 
  ArrowLeftRight, Factory, X,
  FileText, ShoppingCart, FileCheck, ShoppingBag,
  CreditCard, Banknote, Search // Agregado Search para el icono de consulta
} from 'lucide-react';
import { usePermisos, ConPermiso } from '../../context/PermisosContext';
import './Sidebar.css';

function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();
  const { rol, permisos, tienePermiso } = usePermisos();

  console.log('🔐 Sidebar - Rol:', rol);
  console.log('🔐 Sidebar - Permisos:', permisos);

  const menuItems = [
    {
      title: 'Principal',
      items: [
        { path: '/dashboard', icon: Home, label: 'Dashboard', modulo: 'dashboard' }
      ]
    },
    {
      title: 'Módulos Maestros',
      items: [
        { path: '/empleados', icon: Users, label: 'Empleados', modulo: 'empleados' },
        { path: '/flota', icon: Truck, label: 'Flota', modulo: 'flota' },
        { path: '/proveedores', icon: Building2, label: 'Proveedores', modulo: 'proveedores' },
        { path: '/clientes', icon: UserCircle2, label: 'Clientes', modulo: 'clientes' }
      ]
    },
    {
      title: 'Productos',
      items: [
        { path: '/productos', icon: Package, label: 'Catálogo de Productos', modulo: 'productos' },
        // NUEVO ÍTEM AGREGADO AQUÍ
        { path: '/productos/consulta-stock', icon: Search, label: 'Consulta de Stock', modulo: 'consultarStock' }
      ]
    },
    {
      title: 'Producción',
      items: [
        { path: '/produccion/ordenes', icon: Factory, label: 'Órdenes de Producción', modulo: 'ordenesProduccion' }
      ]
    },
    {
      title: 'Ventas',
      items: [
        { path: '/ventas/cotizaciones', icon: FileText, label: 'Cotizaciones', modulo: 'cotizaciones' },
        { path: '/ventas/ordenes', icon: ShoppingCart, label: 'Órdenes de Venta', modulo: 'ordenesVenta' },
        { path: '/ventas/guias-remision', icon: FileCheck, label: 'Guías de Remisión', modulo: 'guiasRemision' },
        { path: '/ventas/guias-transportista', icon: Truck, label: 'Guías de Transportista', modulo: 'guiasTransportista' }
      ]
    },
    {
      title: 'Compras',
      items: [
        { path: '/compras/ordenes', icon: ShoppingBag, label: 'Órdenes de Compra', modulo: 'ordenesCompra' }
      ]
    },
    {
      title: 'Finanzas',
      items: [
        { path: '/finanzas/cuentas-pago', icon: CreditCard, label: 'Cuentas por Pagar', modulo: 'cuentasPago' },
        { path: '/finanzas/pagos-cobranzas', icon: Banknote, label: 'Pagos y Cobranzas', modulo: 'pagosCobranzas' }
      ]
    },
    {
      title: 'Inventario',
      items: [
        { path: '/inventario/entradas', icon: ArrowDownToLine, label: 'Entradas', modulo: 'entradas' },
        { path: '/inventario/salidas', icon: ArrowUpFromLine, label: 'Salidas', modulo: 'salidas' },
        { path: '/inventario/transferencias', icon: ArrowLeftRight, label: 'Transferencias', modulo: 'transferencias' }
      ]
    }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onToggle}></div>
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-image-container">
              <img 
                src="https://indpackperu.com/images/logohorizontal.png" 
                alt="INDPACK Logo" 
                className="sidebar-logo-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="sidebar-logo-fallback" style={{ display: 'none' }}>
                <Package size={32} />
              </div>
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-title">INDPACK</span>
              {rol && (
                <span className="sidebar-rol">{rol}</span>
              )}
            </div>
          </div>
          <button className="sidebar-close" onClick={onToggle}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((section, idx) => {
            const itemsVisibles = section.items.filter(item => tienePermiso(item.modulo));
            
            if (itemsVisibles.length === 0) {
              return null;
            }

            return (
              <div key={idx} className="sidebar-section">
                <div className="sidebar-section-title">{section.title}</div>
                <ul className="sidebar-menu">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const puedeVer = tienePermiso(item.modulo);
                    
                    if (!puedeVer) {
                      return null;
                    }

                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                        >
                          <Icon size={20} />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-footer-text">© 2025 INDPACK</p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;