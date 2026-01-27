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
      {!isLauncher && (
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      )}
      
      <div className={`layout-main ${isLauncher ? 'layout-full' : (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}`}>
        <Navbar onToggleSidebar={toggleSidebar} showMenuButton={!isLauncher} />
        
        <main className="layout-content">
          {children}
        </main>
        
        <footer className="layout-footer">
          <p>INDPACK Sistema de Inventario y Producción - {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}

export default Layout;