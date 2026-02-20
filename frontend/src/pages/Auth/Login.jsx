import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate('/');
    } else {
      alert('❌ ' + result.error);
    }

    setLoading(false);
  };

  return (
    <div className="login-container">

      {/* Panel izquierdo decorativo */}
      <div className="login-left-panel">
        <div className="login-brand-mark">
          <div className="login-logo-wrap">
            <img
              src="https://indpackperu.com/images/logohorizontal.png"
              alt="INDPACK Logo"
              className="login-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div>
            <div className="login-brand-name">Indpack</div>
            <div className="login-brand-sub">Industrial Packaging</div>
          </div>
        </div>

        <div className="login-deco-number" aria-hidden="true">SAC</div>

        <div className="login-left-bottom">
          <div className="login-accent-bar"></div>
          <h2 className="login-tagline">
            Control<br />
            <em>total</em> de<br />
            tu operación
          </h2>
          <p className="login-tagline-desc">
            Gestión de ventas, producción e inventario
            para INDPACK S.A.C.
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-wrapper">
        <span className="login-sys-label">Sistema de Gestión</span>

        <div>
          <h1 className="login-card-title">Acceso</h1>
          <p className="login-card-description">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label className="login-form-label">Correo electrónico</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" size={18} />
              <input
                type="email"
                className="login-input"
                placeholder="usuario@indpack.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Contraseña</label>
            <div className="login-input-wrapper">
              <Lock className="login-input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="login-loading">
                <div className="login-spinner"></div>
                Verificando...
              </span>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">© 2025 INDPACK S.A.C. — Todos los derechos reservados</p>
        </div>
      </div>

    </div>
  );
}

export default Login;