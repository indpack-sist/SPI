import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const isLauncher = location.pathname === '/';

  return (
    <div className="layout">
      {/* 1. Sidebar: Se oculta en el launcher */}
      {!isLauncher && (
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      )}
      
      {/* 2. Contenedor Principal */}
      <div className={`layout-main ${isLauncher ? 'layout-full' : (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}`}>
        
        {/* 3. Navbar: Se oculta si es launcher */}
        {!isLauncher && (
          <Navbar onToggleSidebar={toggleSidebar} showMenuButton={true} />
        )}
        
        {/* 4. Main Content */}
        <main className={`layout-content ${isLauncher ? 'content-launcher' : ''}`}>
          {children}
        </main>
        
        {/* 5. Footer: Se oculta si es launcher */}
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