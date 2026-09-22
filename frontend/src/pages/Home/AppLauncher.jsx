import React from 'react';
import { Link } from 'react-router-dom';
import { LazyMotion, domAnimation, m, MotionConfig } from 'framer-motion';
import { usePermisos } from '../../context/PermisosContext';
import { menuConfig } from '../../config/menuConfig';
import './AppLauncher.css';

// Variantes de animación (solo opacity/transform → GPU, sin reflow).
const periodicVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const blockVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.03 },
  },
};

const gridVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.035 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

// Columnas que ocupa un bloque según su nº de módulos: pocos → bloque pequeño,
// muchos → se reparte en una malla ~cuadrada (nada de tiles estirados).
const columnasBloque = (n) => (n <= 3 ? n : Math.ceil(Math.sqrt(n)));

const AppLauncher = () => {
  const { rol, tienePermiso } = usePermisos();

  // Agrupamos por área (igual que el sidebar), replicando su filtrado por rol/permiso.
  // Cada sección visible se convierte en un "bloque" de la tabla periódica.
  const secciones = menuConfig
    .map(section => ({
      title: section.title,
      items: section.items.filter(item =>
        tienePermiso(item.modulo)
        && !item.rolesExcluidos?.includes(rol)
        && (!item.rolesIncluidos || item.rolesIncluidos.includes(rol))
      ),
    }))
    .filter(section => section.items.length > 0);

  // Numeración atómica continua a través de todas las áreas.
  let numeroAtomico = 0;

  return (
    <div className="launcher-container">

      {/* Partículas de fondo */}
      <ul className="background-shapes">
        <li></li><li></li><li></li><li></li><li></li>
        <li></li><li></li><li></li><li></li><li></li>
      </ul>

      <div className="launcher-content">

        {/* Header — solo título centrado */}
        <div className="launcher-header">
          <div className="launcher-brand">
            <div className="launcher-brand-name">Sistema de Gestión</div>
            <div className="launcher-brand-sub">Empaques Industriales</div>
          </div>
        </div>

        {/* Tabla periódica de módulos: un bloque por área */}
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion="user">
            <m.div
              className="launcher-periodic"
              variants={periodicVariants}
              initial="hidden"
              animate="show"
            >
              {secciones.map((section) => (
                <m.section className="launcher-block" variants={blockVariants} key={section.title}>

                  <div className="launcher-block-header">
                    <span className="launcher-block-title">{section.title}</span>
                    <span className="launcher-block-count">{section.items.length}</span>
                  </div>

                  <m.div
                    className="launcher-block-grid"
                    variants={gridVariants}
                    style={{ '--cols': columnasBloque(section.items.length) }}
                  >
                    {section.items.map((app) => {
                      const Icon = app.icon;
                      numeroAtomico += 1;
                      // Si el app tiene subItems, linkeamos al primero
                      const targetPath = app.subItems && app.subItems.length > 0 ? app.subItems[0].path : app.path;

                      return (
                        <m.div className="launcher-card-cell" variants={cardVariants} key={app.path || app.label}>
                          <Link
                            to={targetPath}
                            className="launcher-card"
                            style={{ '--card-color': app.color || 'var(--accent)' }}
                          >
                            <span className="launcher-card-index">
                              {String(numeroAtomico).padStart(2, '0')}
                            </span>

                            <div className="launcher-icon-wrapper">
                              {app.iconImg
                                ? <img src={app.iconImg} alt="" className="launcher-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                : <Icon size={40} strokeWidth={1.5} />}
                            </div>

                            <span className="launcher-label">{app.label}</span>

                            <div className="launcher-card-shine"></div>
                          </Link>
                        </m.div>
                      );
                    })}
                  </m.div>
                </m.section>
              ))}
            </m.div>
          </MotionConfig>
        </LazyMotion>
      </div>

      <div className="launcher-footer">
        <p>© 2026 INDPACK S.A.C. — Sistema de Gestión</p>
      </div>

    </div>
  );
};

export default AppLauncher;
