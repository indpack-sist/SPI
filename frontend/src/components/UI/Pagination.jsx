import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="ui-pagination mt-6 px-6 py-6 border-t flex flex-col lg:flex-row items-center justify-between gap-6 relative z-20"
      style={{ backgroundColor: 'var(--carbon-mid)', borderColor: 'rgba(58,58,58,0.3)' }}>
      <div className="pagination-nav flex items-center gap-3">
        <button
          className="pagination-nav-btn h-11 px-5 font-black text-[0.7rem] tracking-widest"
          onClick={goToPrevPage}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={20} /> ANTERIOR
        </button>
        <div className="pagination-numbers flex items-center gap-2 mx-2">
          {getPageNumbers().map((num, idx) => (
            num === '...'
              ? <span key={`ell-${idx}`} className="w-10 h-10 flex items-center justify-center font-black" style={{ color: 'var(--steel)' }}>...</span>
              : <button key={`pg-${num}`} onClick={() => cambiarPagina(num)} className={`pagination-page-btn ${currentPage === num ? 'active' : ''}`}>{num}</button>
          ))}
        </div>
        <button
          className="pagination-nav-btn h-11 px-5 font-black text-[0.7rem] tracking-widest"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
        >
          SIGUIENTE <ChevronRight size={20} />
        </button>
      </div>
      <div className="pagination-jump flex items-center gap-4 px-6 py-2.5 border rounded-sm shadow-inner"
        style={{ backgroundColor: 'var(--carbon)', borderColor: 'var(--steel)' }}>
        <span className="text-[0.6rem] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--wire)' }}>Página</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onKeyDown={handlePageJump}
          onBlur={commitInput}
          className="form-input w-16 h-10 text-center text-base font-black text-primary rounded-sm"
        />
        <span className="text-[0.6rem] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--wire)' }}>de {totalPages}</span>
      </div>
    </div>
  );
}

export default Pagination;
