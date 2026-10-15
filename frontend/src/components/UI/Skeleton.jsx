import './Skeleton.css';

function Skeleton({ width = '100%', height = '1rem', radius = '3px', className = '', style = {} }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
