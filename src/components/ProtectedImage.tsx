import React, { useState, useEffect, useRef, useCallback } from 'react'
import { constructImageUrl } from '../utils/cloudflare'

interface ProtectedImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
  showSkeleton?: boolean
  lazy?: boolean
}

const ProtectedImage = ({ 
  src, 
  alt, 
  className, 
  onClick, 
  showSkeleton = true,
  lazy = true
}: ProtectedImageProps) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState<string>('')
  const [isInView, setIsInView] = useState(!lazy)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [lazy, isInView])

  // Extract filename from src to construct URL
  const getFilenameFromSrc = useCallback((url: string): string | null => {
    // If it's already just a filename (no protocol), return it directly
    if (!url.includes('://')) {
      return url
    }
    
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      if (pathParts.length >= 2 && pathParts[pathParts.length - 2] === 'images') {
        return decodeURIComponent(pathParts[pathParts.length - 1])
      }
      return decodeURIComponent(pathParts.pop() || '')
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!isInView) return

    setIsLoading(true)
    setHasError(false)

    const filename = getFilenameFromSrc(src)
    
    if (!filename) {
      // If we can't extract filename, use original src
      setCurrentSrc(src)
    } else {
      // Construct the proper URL
      setCurrentSrc(constructImageUrl(filename))
    }
  }, [src, isInView, getFilenameFromSrc])

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

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
    e.preventDefault()
    return false
  }

  const protectedStyles: React.CSSProperties = {
    userSelect: 'none',
    pointerEvents: 'auto',
    outline: 'none',
    imageRendering: 'auto',
    transition: 'opacity 0.3s ease'
  }

  const combinedClassName = `protected-image ${className || ''}`.trim()

  return (
    <div ref={containerRef} className="protected-image-container" style={{ position: 'relative' }}>
      {/* Skeleton loader */}
      {(isLoading || !isInView) && showSkeleton && (
        <div className="image-skeleton" />
      )}
      
      {/* Error state */}
      {hasError && isInView && (
        <div className="image-error">
          <span>Failed to load image</span>
        </div>
      )}
      
      {/* Main image */}
      {isInView && (
        <img 
          ref={imgRef}
          src={currentSrc} 
          alt={alt} 
          className={combinedClassName}
          onClick={onClick}
          onLoad={handleLoad}
          onError={handleError}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onMouseDown={handleMouseDown}
          style={{
            ...protectedStyles,
            opacity: isLoading ? 0 : 1,
            display: hasError ? 'none' : 'block'
          }}
          draggable={false}
        />
      )}
    </div>
  )
}

export default ProtectedImage