import { useEffect } from 'react';

const ACTION_LABELS = /^(acciones?|opciones?|acción|operaciones?)$/i;

/**
 * Adapta también las tablas antiguas que no usan el componente <Table />.
 * En escritorio solo añade metadatos; la presentación cambia exclusivamente
 * desde las media queries responsive de index.css.
 */
function ResponsiveTables() {
  useEffect(() => {
    let animationFrame = null;

    const enhanceTable = (table) => {
      if (table.dataset.mobileTable === 'scroll') {
        table.classList.add('responsive-table-scroll');
        table.classList.remove('responsive-table-cards');
        return;
      }

      const headerRows = Array.from(table.querySelectorAll('thead > tr'));
      const headerCells = headerRows.length
        ? Array.from(headerRows[headerRows.length - 1].children).filter((cell) => cell.tagName === 'TH')
        : [];

      if (!headerCells.length) {
        table.classList.add('responsive-table-scroll');
        table.classList.remove('responsive-table-cards');
        return;
      }

      const headers = headerCells.map((cell) => (
        cell.dataset.mobileLabel
        || cell.getAttribute('aria-label')
        || cell.textContent.trim().replace(/\s+/g, ' ')
      ));

      table.querySelectorAll('tbody > tr, tfoot > tr').forEach((row) => {
        let columnIndex = 0;

        Array.from(row.children).forEach((cell) => {
          if (cell.tagName !== 'TD') return;

          const authoredLabel = cell.hasAttribute('data-label')
            && cell.dataset.responsiveLabel !== 'true';
          const label = authoredLabel ? cell.dataset.label : (headers[columnIndex] || '');
          if (!authoredLabel) {
            cell.dataset.label = label;
            cell.dataset.responsiveLabel = 'true';
          }

          const isAction = ACTION_LABELS.test(label)
            || (!label && cell.querySelector('button, [role="button"], a.btn'));
          if (isAction) cell.dataset.mobileAction = 'true';
          else delete cell.dataset.mobileAction;

          if (cell.colSpan > 1) cell.dataset.mobileWide = 'true';
          else delete cell.dataset.mobileWide;

          columnIndex += cell.colSpan || 1;
        });
      });

      table.classList.add('responsive-table-cards');
      table.classList.remove('responsive-table-scroll');
    };

    const enhanceAll = () => {
      animationFrame = null;
      document.querySelectorAll('table').forEach(enhanceTable);
    };

    const scheduleEnhancement = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(enhanceAll);
      }
    };

    enhanceAll();
    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}

export default ResponsiveTables;
