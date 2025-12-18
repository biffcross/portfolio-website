import './ProgressIndicator.css'

interface ProgressIndicatorProps {
  progress?: number // 0-100 (optional, not used in icon mode)
  status?: 'pending' | 'uploading' | 'completed' | 'error'
  message?: string
  useIcons?: boolean // New prop to enable icon-based feedback
}

function ProgressIndicator({ 
  progress = 0, 
  status = 'pending', 
  message,
  useIcons = true // Default to icon-based feedback
}: ProgressIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return '⟳'
      case 'completed':
        return '✓'
      case 'error':
        return '✗'
      default:
        return '○'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error'
      default:
        return 'Pending'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return '#17a2b8'
      case 'completed':
        return '#28a745'
      case 'error':
        return '#dc3545'
      default:
        return '#6c757d'
    }
  }

  if (useIcons) {
    return (
      <div className={`progress-indicator icon-mode ${status}`}>
        <div className="status-display">
          <span 
            className="status-icon"
            style={{ 
              color: getStatusColor(),
              animation: status === 'uploading' ? 'spin 1s linear infinite' : 'none'
            }}
          >
            {getStatusIcon()}
          </span>
          <span className="status-text" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </span>
        </div>
        {message && (
          <div className="status-message" style={{ color: getStatusColor() }}>
            {message}
          </div>
        )}
      </div>
    )
  }

  // Legacy progress bar mode (kept for backward compatibility)
  return (
    <div className="progress-indicator bar-mode">
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill"
          style={{ 
            width: `${progress}%`,
            backgroundColor: getStatusColor(),
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      <div className="progress-info">
        <span className="progress-status" style={{ color: getStatusColor() }}>
          {getStatusText()}
        </span>
        {message && <span className="progress-message">{message}</span>}
      </div>
    </div>
  )
}

export default ProgressIndicator