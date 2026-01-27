import { Link, useLocation } from 'react-router-dom';
import { Package, X } from 'lucide-react'; // Solo importamos los iconos estructurales
import { usePermisos } from '../../context/PermisosContext';
import { menuConfig } from '../../config/menuConfig'; // <--- Aquí importamos la configuración central
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
          {menuConfig.map((section, idx) => {
            // Filtramos los items según los permisos del usuario
            const itemsVisibles = section.items.filter(item => tienePermiso(item.modulo));
            
            // Si la sección queda vacía por falta de permisos, no la renderizamos
            if (itemsVisibles.length === 0) {
              return null;
            }

            return (
              <div key={idx} className="sidebar-section">
                <div className="sidebar-section-title">{section.title}</div>
                <ul className="sidebar-menu">
                  {itemsVisibles.map((item) => {
                    // Extraemos el componente Icon que viene en la config
                    const Icon = item.icon;
                    
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                          // Opcional: Si quieres que el sidebar se cierre en móvil al hacer click
                          // onClick={() => window.innerWidth < 768 && onToggle()} 
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