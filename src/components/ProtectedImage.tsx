import React from 'react'

interface ProtectedImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
}

const ProtectedImage = ({ src, alt, className, onClick }: ProtectedImageProps) => {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    return false
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    return false
  }



  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent image saving via mouse actions
    if (e.button === 1) { // Middle mouse button
      e.preventDefault()
    }
    // Also handle select start here
    e.preventDefault()
    return false
  }

  const protectedStyles: React.CSSProperties = {
    userSelect: 'none',
    pointerEvents: 'auto',
    outline: 'none',
    imageRendering: 'auto'
  }

  const combinedClassName = `protected-image ${className || ''}`.trim()

  return (
    <img 
      src={src} 
      alt={alt} 
      className={combinedClassName}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onMouseDown={handleMouseDown}
      style={protectedStyles}
      draggable={false}
      // Additional HTML attributes for protection
      onLoad={(e) => {
        // Disable right-click save options
        const img = e.target as HTMLImageElement
        img.setAttribute('oncontextmenu', 'return false')
      }}
    />
  )
}

export default ProtectedImage