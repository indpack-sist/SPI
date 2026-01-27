import { Link, useLocation } from 'react-router-dom';
import { Package, X, LayoutGrid } from 'lucide-react'; // <--- 1. Agregamos LayoutGrid
import { usePermisos } from '../../context/PermisosContext';
import { menuConfig } from '../../config/menuConfig';
import './Sidebar.css';

function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();
  const { rol, tienePermiso } = usePermisos();

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
          
          {/* --- 2. BOTÓN DE MENÚ DE APPS (Encima de todo) --- */}
          <div className="sidebar-section">
            <ul className="sidebar-menu">
              <li>
                <Link
                  to="/"
                  className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.03)', // Un fondo sutil para destacarlo
                    marginBottom: '10px' // Separación del resto de menús
                  }}
                >
                  <LayoutGrid size={22} color="#4b5563" /> {/* Icono de Apps */}
                  <span style={{ fontWeight: '700', color: '#374151' }}>Menú Principal</span>
                </Link>
              </li>
            </ul>
            {/* Línea divisoria opcional para separar visualmente */}
            <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '0 15px 15px 15px' }}></div>
          </div>
          {/* ------------------------------------------------ */}

          {menuConfig.map((section, idx) => {
            const itemsVisibles = section.items.filter(item => tienePermiso(item.modulo));
            
            if (itemsVisibles.length === 0) {
              return null;
            }

            return (
              <div key={idx} className="sidebar-section">
                <div className="sidebar-section-title">{section.title}</div>
                <ul className="sidebar-menu">
                  {itemsVisibles.map((item) => {
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