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
      <div className="login-wrapper">
        {/* Logo y Título */}
        <div className="login-header">
          <div className="login-logo-container">
            <img 
              src="https://indpackperu.com/images/logohorizontal.png" 
              alt="INDPACK Logo" 
              className="login-logo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'block';
              }}
            />
            <div style={{ display: 'none', fontSize: '3rem' }}>📦</div>
          </div>
          <h1 className="login-title">INDPACK</h1>
          <p className="login-subtitle">Sistema de Gestión</p>
        </div>

        {/* Card del Formulario */}
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-title">Bienvenido</h2>
            <p className="login-card-description">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Email */}
            <div className="login-form-group">
              <label className="login-form-label">
                Correo Electrónico
              </label>
              <div className="login-input-wrapper">
                <Mail className="login-input-icon" size={20} />
                <input
                  type="email"
                  className="login-input"
                  placeholder="admin@indpack.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="login-form-group">
              <label className="login-form-label">
                Contraseña
              </label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={20} />
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
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Botón Submit */}
            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="login-loading">
                  <div className="login-spinner"></div>
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="login-footer-text">
            © 2025 INDPACK. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;