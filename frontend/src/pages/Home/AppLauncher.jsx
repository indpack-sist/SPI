import React from 'react';
import { Link } from 'react-router-dom';
import { usePermisos } from '../../context/PermisosContext'; 
import { menuConfig } from '../../config/menuConfig'; 
import './AppLauncher.css';

const AppLauncher = () => {
  const { tienePermiso } = usePermisos();
  const allApps = menuConfig.flatMap(section => section.items);
  const allowedApps = allApps.filter(app => tienePermiso(app.modulo));

  return (
    <div className="launcher-container">
      
      <div className="background-shapes">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className="launcher-grid">
        {allowedApps.map((app, index) => {
          const Icon = app.icon;
          return (
            <Link 
              to={app.path} 
              key={index} 
              className="launcher-card"
              style={{ '--card-color': app.color || '#555' }} 
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