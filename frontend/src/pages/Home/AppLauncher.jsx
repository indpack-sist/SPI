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

      {/* Partículas de fondo */}
      <ul className="background-shapes">
        <li></li><li></li><li></li><li></li><li></li>
        <li></li><li></li><li></li><li></li><li></li>
      </ul>

      <div className="launcher-content">

        {/* Header */}
        <div className="launcher-header">
          <div className="launcher-header-logo">
            <div className="launcher-logo-box">
              <img
                src="https://indpackperu.com/images/logohorizontal.png"
                alt="INDPACK"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            <div className="launcher-brand">
              <div className="launcher-brand-name">Indpack</div>
              <div className="launcher-brand-sub">Industrial Packaging</div>
            </div>
          </div>

          <div className="launcher-divider"></div>
          <h1>Sistema de Gestión</h1>
          <p>Selecciona un módulo para continuar</p>
        </div>

        {/* Grid de apps */}
        <div className="launcher-grid">
          {allowedApps.map((app, index) => {
            const Icon = app.icon;
            return (
              <Link
                to={app.path}
                key={index}
                className="launcher-card"
                style={{ '--card-color': app.color || '#e8b84b' }}
              >
                <span className="launcher-card-index">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="launcher-icon-wrapper">
                  <Icon size={28} strokeWidth={1.5} />
                </div>

                <span className="launcher-label">{app.label}</span>

                <div className="launcher-card-shine"></div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="launcher-footer">
        <p>© 2026 INDPACK S.A.C. — Sistema de Gestión</p>
      </div>

    </div>
  );
};

export default AppLauncher;