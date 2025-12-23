import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Users, Truck, Building2, UserCircle2, 
  Package, BarChart3, ArrowDownToLine, ArrowUpFromLine, 
  ArrowLeftRight, Factory, X 
} from 'lucide-react';
import './Sidebar.css';

function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();

  const menuItems = [
    {
      title: 'Principal',
      items: [
        { path: '/', icon: Home, label: 'Dashboard' }
      ]
    },
    {
      title: 'Módulos Maestros',
      items: [
        { path: '/empleados', icon: Users, label: 'Empleados' },
        { path: '/flota', icon: Truck, label: 'Flota' },
        { path: '/proveedores', icon: Building2, label: 'Proveedores' },
        { path: '/clientes', icon: UserCircle2, label: 'Clientes' }
      ]
    },
    {
      title: 'Productos',
      items: [
        { path: '/productos', icon: Package, label: 'Catálogo de Productos' }
      ]
    },
    {
      title: 'Inventario',
      items: [
        { path: '/inventario/entradas', icon: ArrowDownToLine, label: 'Entradas' },
        { path: '/inventario/salidas', icon: ArrowUpFromLine, label: 'Salidas' },
        { path: '/inventario/transferencias', icon: ArrowLeftRight, label: 'Transferencias' },
        { path: '/inventario/stock', icon: BarChart3, label: 'Stock por Inventario' }
      ]
    },
    {
      title: 'Producción',
      items: [
        { path: '/produccion/ordenes', icon: Factory, label: 'Órdenes de Producción' }
      ]
    }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onToggle}></div>
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-image-container">
              <img 
                src="/images/indpack.png" 
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
              <span className="sidebar-subtitle">Sistema ERP</span>
            </div>
          </div>
          <button className="sidebar-close" onClick={onToggle}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((section, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">{section.title}</div>
              <ul className="sidebar-menu">
                {section.items.map((item) => {
                  const Icon = item.icon;
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
          ))}
        </nav>

        {/* Footer del Sidebar */}
        <div className="sidebar-footer">
          <p className="sidebar-footer-text">© 2025 INDPACK</p>

        </div>
      </aside>
    </>
  );
}

export default Sidebar;