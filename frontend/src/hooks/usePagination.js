import { useState, useEffect } from 'react';

/**
 * Paginación en memoria reutilizable (mismo comportamiento que OrdenesVenta.jsx).
 *
 * @param {Array} items - lista ya filtrada a paginar
 * @param {Object} [opts]
 * @param {number} [opts.itemsPerPage=20]
 * @param {string} [opts.storageKey] - si se indica, persiste la página en sessionStorage
 * @returns {{ currentPage, setCurrentPage, currentItems, totalPages, totalItems, itemsPerPage }}
 */
export function usePagination(items, opts = {}) {
  const { itemsPerPage = 20, storageKey } = opts;

  const [currentPage, setCurrentPage] = useState(() => {
    if (storageKey) {
      const saved = parseInt(sessionStorage.getItem(storageKey) || '1');
      if (!isNaN(saved) && saved >= 1) return saved;
    }
    return 1;
  });

  const lista = Array.isArray(items) ? items : [];
  const totalItems = lista.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Si la página actual quedó fuera de rango (por ej. tras filtrar), volver a la 1.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (storageKey) sessionStorage.setItem(storageKey, String(currentPage));
  }, [currentPage, storageKey]);

  const indexOfLast = currentPage * itemsPerPage;
  const currentItems = lista.slice(indexOfLast - itemsPerPage, indexOfLast);

  return { currentPage, setCurrentPage, currentItems, totalPages, totalItems, itemsPerPage };
}

export default usePagination;
