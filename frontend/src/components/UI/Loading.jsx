import './Loading.css';
import Skeleton from './Skeleton';

function TableSkeleton({ rows = 6 }) {
  const widths = ['26%', '20%', '16%', '14%', '12%'];
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-toolbar">
        <Skeleton width="220px" height="2rem" />
        <Skeleton width="120px" height="2rem" />
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, r) => (
          <div className="skeleton-row" key={r}>
            {widths.map((w, c) => (
              <Skeleton key={c} width={w} height="0.85rem" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="skeleton-detail">
      <div className="skeleton-detail-head">
        <Skeleton width="min(320px, 70%)" height="1.6rem" />
        <Skeleton width="min(200px, 50%)" height="0.9rem" />
      </div>
      <div className="skeleton-detail-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton-detail-card" key={i}>
            <Skeleton width="55%" height="0.7rem" />
            <Skeleton width="85%" height="1.3rem" />
            <Skeleton width="70%" height="0.7rem" />
          </div>
        ))}
      </div>
      <div className="skeleton-detail-block">
        <Skeleton width="40%" height="1rem" />
        <Skeleton width="100%" height="0.85rem" />
        <Skeleton width="92%" height="0.85rem" />
        <Skeleton width="96%" height="0.85rem" />
      </div>
    </div>
  );
}

function FormSkeleton({ fields = 6 }) {
  return (
    <div className="skeleton-detail-block">
      <Skeleton width="40%" height="1.4rem" />
      {Array.from({ length: fields }).map((_, i) => (
        <div className="skeleton-form-field" key={i}>
          <Skeleton width="30%" height="0.7rem" />
          <Skeleton width="100%" height="2.25rem" />
        </div>
      ))}
    </div>
  );
}

function Loading({ message = 'Cargando...', variant = 'spinner', rows, fields }) {
  if (variant === 'table') return <TableSkeleton rows={rows} />;
  if (variant === 'detail') return <DetailSkeleton />;
  if (variant === 'form') return <FormSkeleton fields={fields} />;

  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

export default Loading;
