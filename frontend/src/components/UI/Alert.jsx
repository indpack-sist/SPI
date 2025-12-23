import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import './Alert.css';

function Alert({ type = 'info', message, onClose }) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const Icon = icons[type];

  return (
    <div className={`alert alert-${type}`}>
      <div className="alert-content">
        <Icon size={20} />
        <span className="alert-message">{message}</span>
      </div>
      {onClose && (
        <button className="alert-close" onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export default Alert;