import './Loading.css';

function Loading({ message = 'Cargando...' }) {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

export default Loading;