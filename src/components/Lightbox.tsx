import { useEffect, useCallback, useState } from 'react'

interface LightboxProps {
  images: string[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

const Lightbox = ({ images, currentIndex, isOpen, onClose, onNext, onPrevious }: LightboxProps) => {
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return

    switch (event.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        event.preventDefault()
        onPrevious()
        break
      case 'ArrowRight':
        event.preventDefault()
        onNext()
        break
    }
  }, [isOpen, onClose, onNext, onPrevious])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      onNext()
    } else if (isRightSwipe) {
      onPrevious()
    }
  }

  // Add keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen || !images.length) return null

  const currentImage = images[currentIndex]
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < images.length - 1

  return (
    <div 
      className="lightbox-overlay" 
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button 
          className="lightbox-close" 
          onClick={onClose}
          aria-label="Close lightbox"
        >
          ×
        </button>

        {/* Previous button */}
        <button 
          className={`lightbox-nav lightbox-prev ${!hasPrevious ? 'lightbox-nav--disabled' : ''}`}
          onClick={onPrevious}
          disabled={!hasPrevious}
          aria-label="Previous image"
        >
          ‹
        </button>

        {/* Main image */}
        <div className="lightbox-image-container">
          <img
            src={currentImage}
            alt={`Image ${currentIndex + 1} of ${images.length}`}
            className="lightbox-image"
            style={{
              userSelect: 'none',
              pointerEvents: 'auto',
              outline: 'none'
            }}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
          />
        </div>

        {/* Next button */}
        <button 
          className={`lightbox-nav lightbox-next ${!hasNext ? 'lightbox-nav--disabled' : ''}`}
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next image"
        >
          ›
        </button>

        {/* Image counter */}
        <div className="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  )
}

export default Lightbox