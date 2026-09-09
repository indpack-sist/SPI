import React from 'react';

const UPDATE_ERROR_EVENT = 'indpack:update-load-error';

class AppErrorBoundary extends React.Component {
  state = { error: null, isUpdateError: false };

  static getDerivedStateFromError(error) {
    return { error, isUpdateError: false };
  }

  componentDidMount() {
    window.addEventListener(UPDATE_ERROR_EVENT, this.handleUpdateError);
  }

  componentWillUnmount() {
    window.removeEventListener(UPDATE_ERROR_EVENT, this.handleUpdateError);
  }

  componentDidCatch(error, info) {
    console.error('Error no recuperable en la interfaz:', error, info);
  }

  handleUpdateError = (event) => {
    this.setState({
      error: event.detail || new Error('No se pudo cargar la versión actualizada.'),
      isUpdateError: true
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#0f172a',
          color: '#e2e8f0'
        }}
      >
        <div style={{ maxWidth: '520px', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '12px', fontSize: '24px' }}>
            {this.state.isUpdateError
              ? 'Hay una nueva versión disponible'
              : 'No se pudo mostrar esta pantalla'}
          </h1>
          <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
            {this.state.isUpdateError
              ? 'No se pudo cargar una parte de la versión anterior. Recarga para continuar con la versión más reciente.'
              : 'Ocurrió un error inesperado en la interfaz. Recarga la aplicación para volver a intentarlo.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              border: 0,
              borderRadius: '8px',
              padding: '10px 18px',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Recargar ahora
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
