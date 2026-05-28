import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, X, LayoutGrid, ChevronDown } from 'lucide-react';
import { usePermisos } from '../../context/PermisosContext';
import { menuConfig } from '../../config/menuConfig';
import './Sidebar.css';

function Sidebar({ onToggle }) {
  const location = useLocation();
  const { rol, tienePermiso } = usePermisos();
  const [openSubmenus, setOpenSubmenus] = useState({});

  const isActive = (path) => location.pathname === path;

  const toggleSubmenu = (label) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  useEffect(() => {
    menuConfig.forEach(section => {
      section.items.forEach(item => {
        if (item.subItems) {
          const hasActiveChild = item.subItems.some(sub => isActive(sub.path));
          if (hasActiveChild) {
            setOpenSubmenus(prev => ({ ...prev, [item.label]: true }));
          }
        }
      });
    });
  }, [location.pathname]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="sidebar-close-btn" onClick={onToggle}>
          <X size={16} />
        </button>
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrap">
            <img
              src="https://media.licdn.com/dms/image/v2/D4E0BAQGFtU-bPEr1-Q/company-logo_200_200/company-logo_200_200/0/1713372855760/indpack_sac_logo?e=2147483647&v=beta&t=WvD8X49nh_Fd-mns3ZAVOvXEHzHpgJU4y9bfVkqyQA4"
              alt="INDPACK"
              className="sidebar-logo-img"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="sidebar-logo-fallback">
              <Package size={20} />
            </div>
          </div>
          <div className="sidebar-brand-info">
            <span className="sidebar-brand-name">INDPACK</span>
            <span className="sidebar-brand-sub">Sistema de Gestión</span>
            {rol && <span className="sidebar-rol-badge">{rol}</span>}
          </div>
        </div>
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
                  <LayoutGrid size={17} />
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
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isOpen = openSubmenus[item.label];

                  if (hasSubItems) {
                    return (
                      <li key={item.label}>
                        <button
                          onClick={() => toggleSubmenu(item.label)}
                          className={`sidebar-link sidebar-dropdown-toggle ${isOpen ? 'open' : ''}`}
                        >
                          <div className="sidebar-icon-container">
                            <Icon size={17} />
                          </div>
                          <span>{item.label}</span>
                          <ChevronDown size={13} className={`sidebar-chevron ${isOpen ? 'rotate' : ''}`} />
                        </button>
                        <ul className={`sidebar-submenu ${isOpen ? 'expanded' : ''}`}>
                          {item.subItems.filter(sub => tienePermiso(sub.modulo)).map((sub) => (
                            <li key={sub.path}>
                              <Link
                                to={sub.path}
                                className={`sidebar-sublink ${isActive(sub.path) ? 'active' : ''}`}
                              >
                                <span className="sidebar-sub-dot"></span>
                                <span>{sub.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  }

                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                      >
                        <div className="sidebar-icon-container">
                          <Icon size={17} />
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
        <div className="sidebar-footer-inner">
          <span className="sidebar-footer-copy">© 2026 INDPACK</span>
          <span className="sidebar-footer-sep">·</span>
          <span className="sidebar-footer-ver">v2.5.0</span>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;