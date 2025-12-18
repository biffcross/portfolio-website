import { useState, useEffect } from 'react'
import FileUploader from '../components/FileUploader'
import { useConfigurationManager } from '../hooks/useConfigurationManager'
import type { UploadResult } from '../services/r2Service'

interface FileUploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  result?: UploadResult
}

interface ImageWithMetadata {
  filename: string
  url: string
  caption: string
  description?: string
  category: string
  order: number
  dimensions: { width: number; height: number }
  uploadDate: string
}

interface DragState {
  isDragging: boolean
  draggedImage: string | null
  dragOverImage: string | null
}

function ImageLibrary() {
  const [showUploader, setShowUploader] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('uncategorized')
  const [editingImage, setEditingImage] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState<ImageWithMetadata | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedImage: null,
    dragOverImage: null
  })
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [showBatchActions, setShowBatchActions] = useState(false)
  // const dragCounter = useRef(0) // Unused for now
  
  const {
    config,
    isLoading: configLoading,
    loadConfiguration,
    updateConfig,
    saveConfiguration
  } = useConfigurationManager()

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration()
  }, [loadConfiguration])

  // Get all images from configuration
  const allImages: ImageWithMetadata[] = config ? 
    Object.entries(config.images).map(([filename, metadata]) => ({
      ...metadata,
      filename,
      url: `${import.meta.env.VITE_R2_PUBLIC_URL}/${filename}`
    })) : []

  // Filter images by selected category
  const filteredImages = selectedCategory === 'all' 
    ? allImages 
    : allImages.filter(img => img.category === selectedCategory)

  // Get available categories
  const categories = config ? [
    { id: 'all', name: 'All Images' },
    { id: 'uncategorized', name: 'Uncategorized' },
    ...config.categories.map(cat => ({ id: cat.id, name: cat.name }))
  ] : []

  const handleFilesSelected = (files: File[]) => {
    console.log('Files selected:', files.map(f => f.name))
  }

  const handleUploadProgress = (progress: FileUploadProgress[]) => {
    console.log('Upload progress:', progress)
  }

  const handleUploadComplete = async (results: UploadResult[]) => {
    if (!config) return

    console.log('Upload completed:', results)

    // Add uploaded images to configuration
    const newImages: Record<string, any> = {}
    
    results.forEach((result, index) => {
      const filename = result.key.split('/').pop() || result.key
      newImages[filename] = {
        filename,
        caption: '',
        description: '',
        category: selectedCategory === 'all' ? 'uncategorized' : selectedCategory,
        order: Object.keys(config.images).length + index + 1,
        dimensions: { width: 0, height: 0 }, // TODO: Extract from image
        uploadDate: new Date().toISOString()
      }
    })

    // Update configuration with new images
    const updatedConfig = {
      ...config,
      images: {
        ...config.images,
        ...newImages
      }
    }

    // Update categories to include new images
    const updatedCategories = config.categories.map(category => {
      if (category.id === selectedCategory || (selectedCategory === 'all' && category.id === 'uncategorized')) {
        const categoryImages = results.map(result => result.key.split('/').pop() || result.key)
        return {
          ...category,
          images: [...category.images, ...categoryImages]
        }
      }
      return category
    })

    updateConfig({
      ...updatedConfig,
      categories: updatedCategories
    })

    // Save to R2
    await saveConfiguration()
    
    // Close uploader
    setShowUploader(false)
  }

  const handleCategoryChange = (imageFilename: string, newCategory: string) => {
    if (!config) return

    // Update image category
    const updatedImages = {
      ...config.images,
      [imageFilename]: {
        ...config.images[imageFilename],
        category: newCategory
      }
    }

    // Update category image lists
    const updatedCategories = config.categories.map(category => {
      // Remove from old category
      const imagesWithoutCurrent = category.images.filter(img => img !== imageFilename)
      
      // Add to new category if this is the target
      if (category.id === newCategory) {
        return {
          ...category,
          images: [...imagesWithoutCurrent, imageFilename]
        }
      }
      
      return {
        ...category,
        images: imagesWithoutCurrent
      }
    })

    updateConfig({
      images: updatedImages,
      categories: updatedCategories
    })
  }

  const handleCaptionEdit = (imageFilename: string) => {
    if (!config) return
    
    setEditingImage(imageFilename)
    setEditCaption(config.images[imageFilename]?.caption || '')
  }

  const handleCaptionSave = async (imageFilename: string) => {
    if (!config) return

    const updatedImages = {
      ...config.images,
      [imageFilename]: {
        ...config.images[imageFilename],
        caption: editCaption
      }
    }

    updateConfig({ images: updatedImages })
    await saveConfiguration()
    
    setEditingImage(null)
    setEditCaption('')
  }

  const handleCaptionCancel = () => {
    setEditingImage(null)
    setEditCaption('')
  }

  // Enhanced metadata editing
  const handleOpenMetadataModal = (image: ImageWithMetadata) => {
    setEditingMetadata(image)
    setEditCaption(image.caption || '')
    setEditDescription(image.description || '')
    setShowMetadataModal(true)
  }

  const handleSaveMetadata = async () => {
    if (!config || !editingMetadata) return

    const updatedImages = {
      ...config.images,
      [editingMetadata.filename]: {
        ...config.images[editingMetadata.filename],
        caption: editCaption,
        description: editDescription
      }
    }

    updateConfig({ images: updatedImages })
    await saveConfiguration()
    
    setShowMetadataModal(false)
    setEditingMetadata(null)
    setEditCaption('')
    setEditDescription('')
  }

  const handleCancelMetadata = () => {
    setShowMetadataModal(false)
    setEditingMetadata(null)
    setEditCaption('')
    setEditDescription('')
  }

  // Order management within category
  const handleMoveImageUp = async (imageFilename: string) => {
    if (!config) return

    const image = config.images[imageFilename]
    if (!image || image.order <= 1) return

    // Find the image with order - 1 in the same category
    const categoryImages = Object.entries(config.images)
      .filter(([_, img]) => img.category === image.category)
      .sort((a, b) => a[1].order - b[1].order)

    const currentIndex = categoryImages.findIndex(([filename]) => filename === imageFilename)
    if (currentIndex <= 0) return

    const [prevFilename, prevImage] = categoryImages[currentIndex - 1]
    
    // Swap orders
    const updatedImages = {
      ...config.images,
      [imageFilename]: { ...image, order: prevImage.order },
      [prevFilename]: { ...prevImage, order: image.order }
    }

    updateConfig({ images: updatedImages })
    await saveConfiguration()
  }

  const handleMoveImageDown = async (imageFilename: string) => {
    if (!config) return

    const image = config.images[imageFilename]
    if (!image) return

    // Find the image with order + 1 in the same category
    const categoryImages = Object.entries(config.images)
      .filter(([_, img]) => img.category === image.category)
      .sort((a, b) => a[1].order - b[1].order)

    const currentIndex = categoryImages.findIndex(([filename]) => filename === imageFilename)
    if (currentIndex >= categoryImages.length - 1) return

    const [nextFilename, nextImage] = categoryImages[currentIndex + 1]
    
    // Swap orders
    const updatedImages = {
      ...config.images,
      [imageFilename]: { ...image, order: nextImage.order },
      [nextFilename]: { ...nextImage, order: image.order }
    }

    updateConfig({ images: updatedImages })
    await saveConfiguration()
  }

  // Batch metadata operations
  const handleBatchSetCaption = async (caption: string) => {
    if (!config || selectedImages.size === 0) return

    const updatedImages = { ...config.images }
    selectedImages.forEach(imageFilename => {
      updatedImages[imageFilename] = {
        ...updatedImages[imageFilename],
        caption
      }
    })

    updateConfig({ images: updatedImages })
    await saveConfiguration()
    setSelectedImages(new Set())
  }

  const handleBatchSetDescription = async (description: string) => {
    if (!config || selectedImages.size === 0) return

    const updatedImages = { ...config.images }
    selectedImages.forEach(imageFilename => {
      updatedImages[imageFilename] = {
        ...updatedImages[imageFilename],
        description
      }
    })

    updateConfig({ images: updatedImages })
    await saveConfiguration()
    setSelectedImages(new Set())
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, imageFilename: string) => {
    e.dataTransfer.setData('text/plain', imageFilename)
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      draggedImage: imageFilename
    }))
  }

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedImage: null,
      dragOverImage: null
    })
  }

  const handleDragOver = (e: React.DragEvent, targetImage: string) => {
    e.preventDefault()
    setDragState(prev => ({
      ...prev,
      dragOverImage: targetImage
    }))
  }

  const handleDragLeave = () => {
    setDragState(prev => ({
      ...prev,
      dragOverImage: null
    }))
  }

  const handleDrop = async (e: React.DragEvent, targetImage: string) => {
    e.preventDefault()
    const draggedImage = e.dataTransfer.getData('text/plain')
    
    if (draggedImage && draggedImage !== targetImage && config) {
      // Reorder images within the same category
      const draggedImageData = config.images[draggedImage]
      const targetImageData = config.images[targetImage]
      
      if (draggedImageData && targetImageData && draggedImageData.category === targetImageData.category) {
        // Get all images in the category
        const categoryImages = Object.entries(config.images)
          .filter(([_, img]) => img.category === draggedImageData.category)
          .sort((a, b) => a[1].order - b[1].order)
        
        // Find positions
        const draggedIndex = categoryImages.findIndex(([filename]) => filename === draggedImage)
        const targetIndex = categoryImages.findIndex(([filename]) => filename === targetImage)
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Reorder the array
          const reorderedImages = [...categoryImages]
          const [draggedItem] = reorderedImages.splice(draggedIndex, 1)
          reorderedImages.splice(targetIndex, 0, draggedItem)
          
          // Update order values
          const updatedImages = { ...config.images }
          reorderedImages.forEach(([filename], index) => {
            updatedImages[filename] = {
              ...updatedImages[filename],
              order: index + 1
            }
          })
          
          updateConfig({ images: updatedImages })
          await saveConfiguration()
        }
      }
    }
    
    handleDragEnd()
  }

  // Batch operations
  const handleImageSelect = (imageFilename: string, selected: boolean) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(imageFilename)
      } else {
        newSet.delete(imageFilename)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedImages(new Set(filteredImages.map(img => img.filename)))
  }

  const handleDeselectAll = () => {
    setSelectedImages(new Set())
  }

  const handleBatchCategoryChange = async (newCategory: string) => {
    if (!config || selectedImages.size === 0) return

    const updatedImages = { ...config.images }
    const updatedCategories = config.categories.map(category => ({
      ...category,
      images: category.images.filter(img => !selectedImages.has(img))
    }))

    // Update each selected image
    selectedImages.forEach(imageFilename => {
      updatedImages[imageFilename] = {
        ...updatedImages[imageFilename],
        category: newCategory
      }
    })

    // Add images to new category
    const targetCategoryIndex = updatedCategories.findIndex(cat => cat.id === newCategory)
    if (targetCategoryIndex !== -1) {
      updatedCategories[targetCategoryIndex].images.push(...Array.from(selectedImages))
    }

    updateConfig({
      images: updatedImages,
      categories: updatedCategories
    })

    await saveConfiguration()
    setSelectedImages(new Set())
    setShowBatchActions(false)
  }

  const handleBatchDelete = async () => {
    if (!config || selectedImages.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedImages.size} images? This action cannot be undone.`)) {
      return
    }

    const updatedImages = { ...config.images }
    const updatedCategories = config.categories.map(category => ({
      ...category,
      images: category.images.filter(img => !selectedImages.has(img))
    }))

    // Remove selected images
    selectedImages.forEach(imageFilename => {
      delete updatedImages[imageFilename]
    })

    updateConfig({
      images: updatedImages,
      categories: updatedCategories
    })

    await saveConfiguration()
    setSelectedImages(new Set())
    setShowBatchActions(false)
  }

  // Toggle batch actions mode
  useEffect(() => {
    setShowBatchActions(selectedImages.size > 0)
  }, [selectedImages.size])

  if (configLoading) {
    return (
      <div>
        <h1 className="page-title">Image Library</h1>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          Loading configuration...
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="page-title">Image Library</h1>
      
      {showUploader ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h3 className="section-title">Upload Images</h3>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>
                  Upload to category:
                </label>
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                >
                  <option value="uncategorized">Uncategorized</option>
                  {config?.categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowUploader(false)}
            >
              Cancel
            </button>
          </div>
          <FileUploader 
            onFilesSelected={handleFilesSelected}
            onUploadProgress={handleUploadProgress}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>
                  {selectedCategory === 'all' ? 'All Images' : 
                   categories.find(c => c.id === selectedCategory)?.name || 'Images'} 
                  ({filteredImages.length})
                </h3>
                {filteredImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      onClick={handleSelectAll}
                    >
                      Select All
                    </button>
                    <button 
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      onClick={handleDeselectAll}
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div>
                  <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>
                    Filter by category:
                  </label>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedImages.size > 0 && (
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
            </div>
            <button 
              className="btn" 
              onClick={() => setShowUploader(true)}
            >
              Upload New Images
            </button>
          </div>

          {/* Batch Actions Bar */}
          {showBatchActions && (
            <div style={{
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '1rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <span style={{ fontWeight: 'bold' }}>
                Batch Actions ({selectedImages.size} selected):
              </span>
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    handleBatchCategoryChange(e.target.value)
                    e.target.value = ''
                  }
                }}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="">Move to category...</option>
                <option value="uncategorized">Uncategorized</option>
                {config?.categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                onClick={handleBatchDelete}
              >
                Delete Selected
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Set caption for all selected..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleBatchSetCaption(e.currentTarget.value.trim())
                      e.currentTarget.value = ''
                    }
                  }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '200px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Set description for all selected..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleBatchSetDescription(e.currentTarget.value.trim())
                      e.currentTarget.value = ''
                    }
                  }}
                  style={{
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    width: '200px'
                  }}
                />
              </div>
            </div>
          )}
          
          {filteredImages.length > 0 ? (
            <>
              <div className="grid grid-3" style={{ gap: '2rem' }}>
                {filteredImages.map((image) => {
                  const isSelected = selectedImages.has(image.filename)
                  const isDraggedOver = dragState.dragOverImage === image.filename
                  const isDragging = dragState.draggedImage === image.filename
                  
                  return (
                    <div 
                      key={image.filename} 
                      className="image-card" 
                      draggable={selectedCategory !== 'all'}
                      onDragStart={(e) => handleDragStart(e, image.filename)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, image.filename)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, image.filename)}
                      style={{
                        border: `2px solid ${isDraggedOver ? '#007bff' : (isSelected ? '#28a745' : '#e0e0e0')}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#fff',
                        opacity: isDragging ? 0.5 : 1,
                        transform: isDraggedOver ? 'scale(1.02)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                        cursor: selectedCategory !== 'all' ? 'move' : 'default'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={image.url} 
                          alt={image.caption || image.filename}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover'
                          }}
                        />
                        {/* Selection checkbox */}
                        <div style={{
                          position: 'absolute',
                          top: '0.5rem',
                          left: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '4px',
                          padding: '0.25rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleImageSelect(image.filename, e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                        </div>
                        {/* Drag indicator */}
                        {selectedCategory !== 'all' && (
                          <div style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem'
                          }}>
                            ⋮⋮
                          </div>
                        )}
                      </div>
                    
                      <div style={{ padding: '1rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong>{image.filename}</strong>
                              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                                Uploaded: {new Date(image.uploadDate).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                Order: {image.order}
                              </div>
                            </div>
                            {selectedCategory !== 'all' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <button
                                  onClick={() => handleMoveImageUp(image.filename)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid #ddd',
                                    borderRadius: '2px',
                                    padding: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem'
                                  }}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => handleMoveImageDown(image.filename)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid #ddd',
                                    borderRadius: '2px',
                                    padding: '0.25rem',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem'
                                  }}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Metadata preview and editing */}
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                              Metadata:
                            </label>
                            <button 
                              className="btn btn-secondary"
                              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => handleOpenMetadataModal(image)}
                            >
                              Edit All
                            </button>
                          </div>
                          
                          {editingImage === image.filename ? (
                            <div>
                              <textarea
                                value={editCaption}
                                onChange={(e) => setEditCaption(e.target.value)}
                                placeholder="Caption..."
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.9rem',
                                  resize: 'vertical'
                                }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button 
                                  className="btn"
                                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => handleCaptionSave(image.filename)}
                                >
                                  Save
                                </button>
                                <button 
                                  className="btn btn-secondary"
                                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                                  onClick={handleCaptionCancel}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div 
                                style={{ 
                                  minHeight: '1.5rem', 
                                  padding: '0.5rem',
                                  background: '#f9f9f9',
                                  border: '1px solid #eee',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  marginBottom: '0.5rem'
                                }}
                                onClick={() => handleCaptionEdit(image.filename)}
                              >
                                <strong>Caption:</strong> {image.caption || <em style={{ color: '#999' }}>Click to add...</em>}
                              </div>
                              {image.description && (
                                <div style={{ 
                                  padding: '0.5rem',
                                  background: '#f9f9f9',
                                  border: '1px solid #eee',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem'
                                }}>
                                  <strong>Description:</strong> {image.description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Category selection */}
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            Category:
                          </label>
                          <select 
                            value={image.category}
                            onChange={(e) => handleCategoryChange(image.filename, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="uncategorized">Uncategorized</option>
                            {config?.categories.map(category => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {selectedCategory !== 'all' && filteredImages.length > 1 && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.5rem',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  color: '#666',
                  textAlign: 'center'
                }}>
                  💡 Tip: Drag and drop images to reorder them within this category
                </div>
              )}
            </>
          ) : (
            <div style={{ 
              border: '1px solid #e0e0e0', 
              padding: '2rem', 
              textAlign: 'center',
              color: '#666'
            }}>
              {selectedCategory === 'all' 
                ? 'No images uploaded yet. Click "Upload New Images" to get started.'
                : (() => {
                    const categoryName = categories.find(c => c.id === selectedCategory)?.name || 'this category';
                    return `No images in ${categoryName} yet.`;
                  })()
              }
            </div>
          )}
        </div>
      )}

      {/* Metadata Editing Modal */}
      {showMetadataModal && editingMetadata && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
              Edit Metadata: {editingMetadata.filename}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <img 
                src={editingMetadata.url}
                alt={editingMetadata.caption || editingMetadata.filename}
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'cover',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Caption:
              </label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                placeholder="Enter a caption for this image..."
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Description:
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  resize: 'vertical'
                }}
                placeholder="Enter a detailed description for this image..."
              />
            </div>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Image Information:</h4>
              <div style={{ fontSize: '0.8rem', color: '#666', lineHeight: '1.6' }}>
                <div><strong>Filename:</strong> {editingMetadata.filename}</div>
                <div><strong>Category:</strong> {editingMetadata.category}</div>
                <div><strong>Order:</strong> {editingMetadata.order}</div>
                <div><strong>Upload Date:</strong> {new Date(editingMetadata.uploadDate).toLocaleDateString()}</div>
                {editingMetadata.dimensions.width > 0 && (
                  <div><strong>Dimensions:</strong> {editingMetadata.dimensions.width} × {editingMetadata.dimensions.height}</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={handleCancelMetadata}
              >
                Cancel
              </button>
              <button 
                className="btn"
                onClick={handleSaveMetadata}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageLibrary