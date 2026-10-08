import { useState, useEffect } from 'react';

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
