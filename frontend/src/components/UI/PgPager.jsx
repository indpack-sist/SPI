import { ChevronLeft, ChevronRight } from 'lucide-react';

function PgPager({ currentPage, totalPages, totalItems, itemsPerPage, setCurrentPage, sustantivo = 'registros' }) {
  if (totalItems <= itemsPerPage) return null;

  const desde = (currentPage - 1) * itemsPerPage + 1;
  const hasta = Math.min(currentPage * itemsPerPage, totalItems);

  const numeros = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = [...new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])]
      .filter(n => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);
    return nums.reduce((acc, n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);
  })();

  return (
    <div className="pg-pager">
      <span><b>{desde}</b>–<b>{hasta}</b> de <b>{totalItems}</b> {sustantivo}</span>
      <div className="pg-pager-nav">
        <button type="button" className="pagination-nav-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
          <ChevronLeft size={15} /> Anterior
        </button>
        {numeros.map((n, i) => (
          n === '…'
            ? <span key={`e-${i}`} className="pg-muted">…</span>
            : <button key={n} type="button" className={`pagination-page-btn ${n === currentPage ? 'active' : ''}`} aria-current={n === currentPage ? 'page' : undefined} onClick={() => setCurrentPage(n)}>{n}</button>
        ))}
        <button type="button" className="pagination-nav-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
          Siguiente <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default PgPager;
