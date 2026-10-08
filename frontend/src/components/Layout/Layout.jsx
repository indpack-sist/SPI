import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();

  const isLauncher = location.pathname === '/';

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const handleBreakpointChange = (event) => setSidebarOpen(event.matches);

    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  return (
    <div className="layout">
      {!isLauncher && (
        <>
          <div
            className={`layout-overlay ${sidebarOpen ? 'visible' : ''}`} 
            onClick={() => setSidebarOpen(false)}
          />
          
          <aside className={`layout-sidebar-wrapper ${sidebarOpen ? 'open' : 'closed'}`}>
            <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
          </aside>
        </>
      )}

      <div className={`layout-main ${isLauncher ? 'layout-full' : (sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}`}>

        {!isLauncher && (
          <Navbar onToggleSidebar={toggleSidebar} showMenuButton={true} />
        )}

        <main className={`layout-content ${isLauncher ? 'content-launcher' : ''}`}>
          {children}
        </main>

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
