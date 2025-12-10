import { useState } from 'react'
import ProtectedImage from './ProtectedImage'
import Lightbox from './Lightbox'

interface ImageGridProps {
  images: string[]
  onImageClick?: (index: number) => void
  layout?: 'horizontal' | 'grid'
  maxHeight?: number
}

const ImageGrid = ({ 
  images, 
  onImageClick, 
  layout = 'grid',
  maxHeight = 400 
}: ImageGridProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index)
    } else {
      setCurrentImageIndex(index)
      setLightboxOpen(true)
    }
  }

  const handleLightboxClose = () => {
    setLightboxOpen(false)
  }

  const handleNext = () => {
    setCurrentImageIndex((prev) => 
      prev < images.length - 1 ? prev + 1 : prev
    )
  }

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => 
      prev > 0 ? prev - 1 : prev
    )
  }

  if (!images || images.length === 0) {
    return (
      <div className="image-grid image-grid--empty">
        <p className="image-grid__empty-message">No images to display.</p>
      </div>
    )
  }

  const containerClass = layout === 'horizontal' 
    ? 'image-grid image-grid--horizontal'
    : 'image-grid image-grid--grid'

  return (
    <div 
      className={containerClass}
      style={{ '--max-height': `${maxHeight}px` } as React.CSSProperties}
    >
      <div className="image-grid__container">
        {images.map((image, index) => (
          <div 
            key={index} 
            className="image-grid__item"
            onClick={() => handleImageClick(index)}
          >
            <ProtectedImage
              src={image}
              alt={`Image ${index + 1}`}
              className="image-grid__image"
            />
          </div>
        ))}
      </div>

      <Lightbox
        images={images}
        currentIndex={currentImageIndex}
        isOpen={lightboxOpen}
        onClose={handleLightboxClose}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  )
}

export default ImageGrid