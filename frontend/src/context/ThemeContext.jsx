import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

function getTemaInicial() {
  try {
    const guardado = localStorage.getItem('theme');
    if (guardado === 'light' || guardado === 'dark') return guardado;
  } catch (e) {
  }
  return 'dark';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getTemaInicial);
  const primerRender = useRef(true);

  useEffect(() => {
    const root = document.documentElement;

    const persistir = () => {
      try {
        localStorage.setItem('theme', theme);
      } catch (e) {
      }
    };

    if (primerRender.current) {
      primerRender.current = false;
      root.setAttribute('data-theme', theme);
      persistir();
      return;
    }

    root.classList.add('theme-transition-stop');
    root.setAttribute('data-theme', theme);
    void root.offsetHeight;
    persistir();

    const id = window.requestAnimationFrame(() => {
      root.classList.remove('theme-transition-stop');
    });
    return () => window.cancelAnimationFrame(id);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
