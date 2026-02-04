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
      
      {/* Fondo Animado Optimizado */}
      <div className="background-shapes">
        <li></li><li></li><li></li><li></li><li></li>
        <li></li><li></li><li></li><li></li><li></li>
      </div>

      <div className="launcher-content">
        <div className="launcher-header">
          <h1>Bienvenido a INDPACK</h1>
          <p>Selecciona una aplicación para comenzar</p>
        </div>

        <div className="launcher-grid">
          {allowedApps.map((app, index) => {
            const Icon = app.icon;
            return (
              <Link 
                to={app.path} 
                key={index} 
                className="launcher-card"
                style={{ '--card-color': app.color || '#64748b' }} 
              >
                <div className="launcher-icon-wrapper">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <span className="launcher-label">{app.label}</span>
                <div className="launcher-card-shine"></div>
              </Link>
            );
          })}
        </div>
      </div>
      
      <div className="launcher-footer">
        <p>© 2026 Sistema de Gestión INDPACK</p>
      </div>
    </div>
  );
};

export default AppLauncher;