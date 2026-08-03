import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Controles de paginación con el mismo diseño/comportamiento que OrdenesVenta.jsx.
 * Solo se renderiza si totalItems > itemsPerPage.
 *
 * Props:
 *  - currentPage, totalPages, totalItems, itemsPerPage
 *  - setCurrentPage (u onPageChange) : (n:number) => void
 * Es compatible con el objeto que devuelve usePagination() usando spread: <Pagination {...pag} />
 */
function Pagination({ currentPage, totalPages, totalItems, itemsPerPage = 20, setCurrentPage, onPageChange }) {
  const cambiarPagina = setCurrentPage || onPageChange || (() => {});
  const [inputPage, setInputPage] = useState(String(currentPage));

  useEffect(() => {
    setInputPage(String(currentPage));
  }, [currentPage]);

  if (!totalItems || totalItems <= itemsPerPage) return null;

  const goToNextPage = () => cambiarPagina(Math.min(currentPage + 1, totalPages));
  const goToPrevPage = () => cambiarPagina(Math.max(currentPage - 1, 1));

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handlePageJump = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputPage);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        cambiarPagina(page);
      } else {
        setInputPage(String(currentPage));
      }
    }
  };

  const commitInput = () => {
    const p = parseInt(inputPage);
    if (!isNaN(p) && p >= 1 && p <= totalPages) cambiarPagina(p);
    else setInputPage(String(currentPage));
  };

  return (
    <div className="ui-pagination mt-6 px-6 py-6 bg-carbon-mid border-t border-steel/30 flex flex-col lg:flex-row items-center justify-between gap-6 relative z-20">
      <style dangerouslySetInnerHTML={{__html: `
        .ui-pagination button.pagination-btn {
          background-color: var(--carbon-mid); border: 2px solid var(--steel); color: var(--mist);
          width: 44px; height: 44px; min-width: 44px; display: flex;
          align-items: center; justify-content: center; border-radius: 8px;
          font-weight: 800; font-size: 1rem; cursor: pointer; transition: all 0.2s;
        }
        .ui-pagination button.pagination-btn-active {
          background-color: var(--primary); border-color: var(--primary); color: #000;
          box-shadow: 0 0 20px rgba(232, 184, 75, 0.4); transform: scale(1.1); z-index: 20;
        }
        .ui-pagination button.pagination-btn:hover:not(.pagination-btn-active) {
          border-color: var(--primary); color: var(--primary); background-color: var(--carbon-light);
        }
      `}} />
      <div className="flex items-center gap-3">
        <button
          className="btn btn-outline border-steel h-11 px-5 flex items-center gap-2 font-black text-[0.7rem] tracking-widest hover:border-primary hover:text-primary transition-all"
          onClick={goToPrevPage}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={20} /> ANTERIOR
        </button>
        <div className="flex items-center gap-2 mx-2">
          {getPageNumbers().map((num, idx) => (
            num === '...'
              ? <span key={`ell-${idx}`} className="w-10 h-10 flex items-center justify-center text-steel font-black">...</span>
              : <button key={`pg-${num}`} onClick={() => cambiarPagina(num)} className={`pagination-btn ${currentPage === num ? 'pagination-btn-active' : ''}`}>{num}</button>
          ))}
        </div>
        <button
          className="btn btn-outline border-steel h-11 px-5 flex items-center gap-2 font-black text-[0.7rem] tracking-widest hover:border-primary hover:text-primary transition-all"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
        >
          SIGUIENTE <ChevronRight size={20} />
        </button>
      </div>
      <div className="flex items-center gap-4 px-6 py-2.5 bg-carbon border border-steel rounded-lg shadow-inner">
        <span className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em]">Página</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onKeyDown={handlePageJump}
          onBlur={commitInput}
          className="w-16 h-10 text-center text-base font-black text-primary bg-carbon-mid border-2 border-steel rounded focus:border-primary outline-none transition-all"
        />
        <span className="text-[0.6rem] font-black text-wire uppercase tracking-[0.2em]">de {totalPages}</span>
      </div>
    </div>
  );
}

export default Pagination;
