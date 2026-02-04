import { Link, useLocation } from 'react-router-dom';
import { Package, X, LayoutGrid } from 'lucide-react';
import { usePermisos } from '../../context/PermisosContext';
import { menuConfig } from '../../config/menuConfig';
import './Sidebar.css';

function Sidebar({ onToggle }) {
  const location = useLocation();
  const { rol, tienePermiso } = usePermisos();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="sidebar">
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
              <Package size={24} />
            </div>
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-title">INDPACK</span>
            {rol && (
              <span className="sidebar-rol">{rol}</span>
            )}
          </div>
        </div>
        <button className="sidebar-close-btn" onClick={onToggle}>
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <ul className="sidebar-menu">
            <li>
              <Link
                to="/"
                className={`sidebar-link sidebar-link-apps ${location.pathname === '/' ? 'active' : ''}`}
              >
                <div className="sidebar-icon-container">
                    <LayoutGrid size={20} />
                </div>
                <span>Menú Principal</span>
              </Link>
            </li>
          </ul>
          <div className="sidebar-divider"></div>
        </div>

        {menuConfig.map((section, idx) => {
          const itemsVisibles = section.items.filter(item => tienePermiso(item.modulo));
          
          if (itemsVisibles.length === 0) return null;

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
                        <div className="sidebar-icon-container">
                            <Icon size={20} />
                        </div>
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
        <p className="sidebar-footer-text">© 2026 INDPACK System</p>
        <p className="sidebar-footer-version">v2.5.0</p>
      </div>
    </div>
  );
}

export default Sidebar;