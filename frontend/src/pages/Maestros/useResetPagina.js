import { useEffect, useRef } from 'react';

export function useResetPagina(setCurrentPage, deps) {
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setCurrentPage(1);
  }, deps);
}

export default useResetPagina;
