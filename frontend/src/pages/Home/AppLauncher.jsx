import React from 'react';
import { Link } from 'react-router-dom';
import { usePermisos } from '../../context/PermisosContext'; // Ajusta la ruta a tu context
import { menuConfig } from '../../config/menuConfig'; // Ajusta la ruta a tu config
import './AppLauncher.css';

const AppLauncher = () => {
  const { tienePermiso } = usePermisos();

  // Aplanamos la estructura: obtenemos todos los items de todas las secciones en un solo array
  const allApps = menuConfig.flatMap(section => section.items);

  // Filtramos según permisos
  const allowedApps = allApps.filter(app => tienePermiso(app.modulo));

  return (
    <div className="launcher-container">
      <div className="launcher-grid">
        {allowedApps.map((app, index) => {
          const Icon = app.icon;
          return (
            <Link 
              to={app.path} 
              key={index} 
              className="launcher-card"
              style={{ '--card-color': app.color || '#555' }} // Variable CSS para el hover/borde
            >
              <div className="icon-wrapper" style={{ backgroundColor: app.color || '#555' }}>
                <Icon size={32} color="#fff" />
              </div>
              <span className="app-label">{app.label}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="launcher-footer">
        <p>Sistema de Gestión INDPACK</p>
      </div>
    </div>
  );
};

export default AppLauncher;