import { useState } from 'react'
import ProtectedImage from './ProtectedImage'
import Lightbox from './Lightbox'

interface GalleryProps {
  images: string[]
  category?: string
  onImageClick?: (index: number) => void
  maxHeight?: number
}

const Gallery = ({ images, category, onImageClick, maxHeight = 500 }: GalleryProps) => {
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
      <div className="gallery gallery--empty">
        <p className="gallery__empty-message">No images available in this category.</p>
      </div>
    )
  }

  return (
    <div className="gallery">
      <div 
        className="gallery__container"
        style={{ '--max-height': `${maxHeight}px` } as React.CSSProperties}
      >
        <div className="gallery__scroll">
          {images.map((image, index) => (
            <div 
              key={index} 
              className="gallery__item"
              onClick={() => handleImageClick(index)}
            >
              <ProtectedImage
                src={image}
                alt={`${category || 'Featured'} ${index + 1}`}
                className="gallery__image"
              />
            </div>
          ))}
        </div>
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

export default Gallery