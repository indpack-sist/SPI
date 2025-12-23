import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="layout">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      <div className={`layout-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Navbar onToggleSidebar={toggleSidebar} />
        
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