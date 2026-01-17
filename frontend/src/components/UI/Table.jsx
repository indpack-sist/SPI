import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Table.css';

function Table({ 
  columns, 
  data, 
  loading = false,
  emptyMessage = 'No hay datos para mostrar',
  pagination = null,
  onPageChange = null,
  onRowClick = null
}) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-container">
        <div className="table-empty">
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th 
                  key={index} 
                  style={{ 
                    width: column.width,
                    textAlign: column.align || 'left'
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}
              >
                {columns.map((column, colIndex) => (
                  <td 
                    key={colIndex}
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {column.render 
                      ? column.render(row[column.accessor], row, rowIndex)
                      : row[column.accessor]
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange && (
        <div className="table-pagination">
          <div className="pagination-info">
            Mostrando {pagination.from} - {pagination.to} de {pagination.total} registros
          </div>
          
          <div className="pagination-controls">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            
            <span className="pagination-pages">
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>
            
            <button
              className="btn btn-sm btn-outline"
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;