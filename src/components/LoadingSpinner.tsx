import React from 'react'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  message?: string
  className?: string
}

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  className = '' 
}: LoadingSpinnerProps) => {
  const sizeClass = `loading-spinner--${size}`
  const combinedClassName = `loading-spinner ${sizeClass} ${className}`.trim()

  return (
    <div className={combinedClassName}>
      <div className="loading-spinner__circle" />
      {message && <p className="loading-spinner__message">{message}</p>}
    </div>
  )
}

export default LoadingSpinner