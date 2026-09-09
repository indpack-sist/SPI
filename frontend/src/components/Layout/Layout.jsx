import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';

function Layout({ children }) {
  // En móvil y tablet el menú funciona como panel superpuesto y empieza cerrado.
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();

  const isLauncher = location.pathname === '/';

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Lógica 2026: Cerrar menú automáticamente al cambiar de ruta (solo en móvil)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Mantiene el comportamiento correcto al rotar el dispositivo o redimensionar.
  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const handleBreakpointChange = (event) => setSidebarOpen(event.matches);

    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  return (
    <div className="layout">
      {/* 1. Sidebar Wrapper: Controla la posición flotante vs estática */}
      {!isLauncher && (
        <>
          {/* Fondo oscuro para móvil (Overlay) */}
          <div 
            className={`layout-overlay ${sidebarOpen ? 'visible' : ''}`} 
            onClick={() => setSidebarOpen(false)}
          />
          
          <aside className={`layout-sidebar-wrapper ${sidebarOpen ? 'open' : 'closed'}`}>
            <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
          </aside>
        </>
      )}
      
      {/* 2. Contenedor Principal */}
      <div className={`layout-main ${isLauncher ? 'layout-full' : (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}`}>
        
        {/* 3. Navbar */}
        {!isLauncher && (
          <Navbar onToggleSidebar={toggleSidebar} showMenuButton={true} />
        )}
        
        {/* 4. Main Content */}
        <main className={`layout-content ${isLauncher ? 'content-launcher' : ''}`}>
          {children}
        </main>
        
        {/* 5. Footer */}
        {!isLauncher && (
          <footer className="layout-footer">
            <p>INDPACK Sistema de Inventario y Producción - {new Date().getFullYear()}</p>
          </footer>
        )}
      </div>
    </div>
  );
}

export default Layout;
