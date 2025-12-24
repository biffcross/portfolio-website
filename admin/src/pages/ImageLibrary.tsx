import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import FileUploader from '../components/FileUploader'
import CategoryTags from '../components/CategoryTags'
import { useConfigurationManager } from '../hooks/useConfigurationManager'
import { useElectronR2 } from '../hooks/useElectronR2'
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
  categories: string[]
  order: number
  categoryOrders?: Record<string, number>
  uploadDate: string
  is_featured: boolean
  // Legacy support for migration
  category?: string
}

function ImageLibrary() {
  const [searchParams] = useSearchParams()
  const [showUploader, setShowUploader] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [showBatchActions, setShowBatchActions] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  
  const {
    config,
    isLoading: configLoading,
    loadConfiguration,
    updateConfig,
    saveConfiguration
  } = useConfigurationManager()

  const { deleteFile, deleteFiles } = useElectronR2()

  // Helper function to get category-specific order
  const getCategoryOrder = (image: ImageWithMetadata, categoryId: string): number => {
    if (image.categoryOrders && image.categoryOrders[categoryId] !== undefined) {
      return image.categoryOrders[categoryId]
    }
    // Fallback to global order for legacy images
    return image.order
  }

  // Helper function to get images sorted by category order
  const getImagesSortedByCategory = (categoryId: string): ImageWithMetadata[] => {
    return allImages
      .filter(img => img.categories.includes(categoryId))
      .sort((a, b) => getCategoryOrder(a, categoryId) - getCategoryOrder(b, categoryId))
  }

  // Load configuration on mount
  useEffect(() => {
    const loadAndResetState = async () => {
      await loadConfiguration()
      setHasUnsavedChanges(false) // Reset unsaved changes only after loading from server
    }
    loadAndResetState()
  }, [loadConfiguration])

  // Handle URL filter parameter
  useEffect(() => {
    const filterParam = searchParams.get('filter')
    if (filterParam === 'featured') {
      setSelectedCategory('featured')
    } else if (filterParam && config?.categories.some(cat => cat.id === filterParam)) {
      // Set category filter if it's a valid category ID
      setSelectedCategory(filterParam)
    }
  }, [searchParams, config])

  // Get all images from configuration
  const allImages: ImageWithMetadata[] = config ? 
    Object.entries(config.images).map(([filename, metadata]) => ({
      filename,
      url: `${import.meta.env.VITE_R2_PUBLIC_URL}/images/${filename}`,
      categories: metadata.categories || (metadata.category ? [metadata.category] : []),
      order: metadata.order,
      categoryOrders: metadata.categoryOrders,
      uploadDate: metadata.uploadDate,
      is_featured: metadata.is_featured || false,
      // Keep legacy category for backward compatibility during transition
      category: metadata.category
    })) : []

  // Filter images by selected category and sort by category-specific order
  const filteredImages = selectedCategory === 'all' 
    ? allImages.sort((a, b) => a.order - b.order) // Global order for 'all' view
    : selectedCategory === 'featured'
    ? allImages
        .filter(img => img.is_featured)
        .sort((a, b) => a.order - b.order) // Global order for featured images
    : selectedCategory === 'uncategorized'
    ? allImages
        .filter(img => img.categories.length === 0 || (img.categories.length === 1 && img.categories[0] === 'uncategorized'))
        .sort((a, b) => a.order - b.order) // Global order for uncategorized
    : getImagesSortedByCategory(selectedCategory) // Category-specific order

  // Get available categories
  const categories = config ? [
    { id: 'all', name: 'All Images' },
    { id: 'featured', name: 'Featured Images' },
    { id: 'uncategorized', name: 'Uncategorized' },
    ...config.categories.map(cat => ({ id: cat.id, name: cat.name }))
  ] : []

  const handleFilesSelected = (_files: File[]) => {
    // Files selected for upload
  }

  const handleUploadProgress = (_progress: FileUploadProgress[]) => {
    // Upload progress tracking
  }

  const handleUploadComplete = async (results: UploadResult[]) => {
    if (!config) return

    // Validate that we have successful upload results
    if (!results || results.length === 0) return

    // Validate that all results have the required properties
    const validResults = results.filter(result => result.key && result.url && result.size !== undefined)
    if (validResults.length !== results.length) return

    // Add uploaded images to configuration
    const newImages: Record<string, any> = {}
    
    results.forEach((result, index) => {
      const filename = result.key.split('/').pop() || result.key
      const imageCategory = selectedCategory === 'all' ? 'uncategorized' : selectedCategory
      
      newImages[filename] = {
        filename,
        categories: imageCategory === 'uncategorized' ? [] : [imageCategory],
        order: Object.keys(config.images).length + index + 1,
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

    // Update categories to include new images (only if not uncategorized)
    const targetCategory = selectedCategory === 'all' ? 'uncategorized' : selectedCategory
    const updatedCategories = targetCategory === 'uncategorized' 
      ? config.categories // Don't modify categories for uncategorized images
      : config.categories.map(category => {
          if (category.id === targetCategory) {
            const categoryImages = results.map(result => result.key.split('/').pop() || result.key)
            return {
              ...category,
              images: [...category.images, ...categoryImages]
            }
          }
          return category
        })

    updateConfig({
      images: updatedConfig.images,
      categories: updatedCategories
    })

    try {
      // Save to R2 - pass the updated config directly to avoid state timing issues
      const configToSave = {
        ...updatedConfig,
        categories: updatedCategories
      }
      const saveSuccess = await saveConfiguration(configToSave)
      
      // Show success message
      if (saveSuccess) {
        setUploadSuccess(`Successfully uploaded ${results.length} image${results.length !== 1 ? 's' : ''}!`)
        setTimeout(() => setUploadSuccess(null), 5000) // Clear after 5 seconds
      }
    } catch (error) {
      console.error('Error during save:', error)
    }
    
    try {
      // Reload configuration to show new images
      await loadConfiguration()
      setHasUnsavedChanges(false) // Reset after reload since upload auto-saves
    } catch (error) {
      console.error('Error during config reload:', error)
    }
  }

  const handleFeaturedToggle = (imageFilename: string, is_featured: boolean) => {
    if (!config) return

    // Update image featured status
    const updatedImages = {
      ...config.images,
      [imageFilename]: {
        ...config.images[imageFilename],
        is_featured
      }
    }

    updateConfig({
      images: updatedImages
    })

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)
  }

  const handleBatchFeaturedToggle = (is_featured: boolean) => {
    if (!config || selectedImages.size === 0) return

    const updatedImages = { ...config.images }

    // Update each selected image
    selectedImages.forEach(imageFilename => {
      updatedImages[imageFilename] = {
        ...updatedImages[imageFilename],
        is_featured
      }
    })

    updateConfig({
      images: updatedImages
    })

    setHasUnsavedChanges(true)
    setSelectedImages(new Set())
    setShowBatchActions(false)
  }

  const handleCategoriesChange = (imageFilename: string, newCategories: string[]) => {
    if (!config) return

    // Get current image
    const currentImage = config.images[imageFilename]
    if (!currentImage) return

    // Update image categories
    const updatedImages = {
      ...config.images,
      [imageFilename]: {
        ...config.images[imageFilename],
        categories: [...newCategories]
      }
    }

    // Update category image lists
    const updatedCategories = config.categories.map(category => {
      // Remove from all categories first
      const imagesWithoutCurrent = category.images.filter(img => img !== imageFilename)
      
      // Add to new categories if this category is in the new list
      if (newCategories.includes(category.id)) {
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

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)
  }

  // Order management within category
  const handleMoveImageUp = async (imageFilename: string) => {
    if (!config) return

    const image = config.images[imageFilename]
    if (!image) return

    // Get the primary category (first category in the array, or legacy category)
    const primaryCategory = image.categories?.[0] || image.category
    if (!primaryCategory) return

    // Get images sorted by category order
    const categoryImages = getImagesSortedByCategory(primaryCategory)
    const currentIndex = categoryImages.findIndex(img => img.filename === imageFilename)
    
    if (currentIndex <= 0) return

    const currentImage = categoryImages[currentIndex]
    const prevImage = categoryImages[currentIndex - 1]
    
    // Swap category orders
    const updatedImages = { ...config.images }
    
    // Update current image's category order
    const currentCategoryOrders = currentImage.categoryOrders ? { ...currentImage.categoryOrders } : {}
    const prevCategoryOrders = prevImage.categoryOrders ? { ...prevImage.categoryOrders } : {}
    
    const currentOrder = getCategoryOrder(currentImage, primaryCategory)
    const prevOrder = getCategoryOrder(prevImage, primaryCategory)
    
    currentCategoryOrders[primaryCategory] = prevOrder
    prevCategoryOrders[primaryCategory] = currentOrder
    
    updatedImages[imageFilename] = {
      ...updatedImages[imageFilename],
      categoryOrders: currentCategoryOrders
    }
    
    updatedImages[prevImage.filename] = {
      ...updatedImages[prevImage.filename],
      categoryOrders: prevCategoryOrders
    }

    updateConfig({ images: updatedImages })
    setHasUnsavedChanges(true)
  }

  const handleMoveImageDown = async (imageFilename: string) => {
    if (!config) return

    const image = config.images[imageFilename]
    if (!image) return

    // Get the primary category (first category in the array, or legacy category)
    const primaryCategory = image.categories?.[0] || image.category
    if (!primaryCategory) return

    // Get images sorted by category order
    const categoryImages = getImagesSortedByCategory(primaryCategory)
    const currentIndex = categoryImages.findIndex(img => img.filename === imageFilename)
    
    if (currentIndex >= categoryImages.length - 1) return

    const currentImage = categoryImages[currentIndex]
    const nextImage = categoryImages[currentIndex + 1]
    
    // Swap category orders
    const updatedImages = { ...config.images }
    
    // Update current image's category order
    const currentCategoryOrders = currentImage.categoryOrders ? { ...currentImage.categoryOrders } : {}
    const nextCategoryOrders = nextImage.categoryOrders ? { ...nextImage.categoryOrders } : {}
    
    const currentOrder = getCategoryOrder(currentImage, primaryCategory)
    const nextOrder = getCategoryOrder(nextImage, primaryCategory)
    
    currentCategoryOrders[primaryCategory] = nextOrder
    nextCategoryOrders[primaryCategory] = currentOrder
    
    updatedImages[imageFilename] = {
      ...updatedImages[imageFilename],
      categoryOrders: currentCategoryOrders
    }
    
    updatedImages[nextImage.filename] = {
      ...updatedImages[nextImage.filename],
      categoryOrders: nextCategoryOrders
    }

    updateConfig({ images: updatedImages })
    setHasUnsavedChanges(true)
  }

  const handleSaveChanges = async () => {
    if (!config || !hasUnsavedChanges) return

    setIsSaving(true)
    setSaveSuccess(null)

    try {
      const success = await saveConfiguration(config)
      
      if (success) {
        setHasUnsavedChanges(false)
        setSaveSuccess('All changes saved successfully!')
        setTimeout(() => setSaveSuccess(null), 5000) // Clear after 5 seconds
      } else {
        alert('Failed to save changes. Please try again.')
      }
    } catch (error) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Batch metadata operations

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
        categories: newCategory === 'uncategorized' ? [] : [newCategory]
      }
    })

    // Add images to new category (only if it's not 'uncategorized')
    if (newCategory !== 'uncategorized') {
      const targetCategoryIndex = updatedCategories.findIndex(cat => cat.id === newCategory)
      if (targetCategoryIndex !== -1) {
        updatedCategories[targetCategoryIndex].images.push(...Array.from(selectedImages))
      }
    }

    updateConfig({
      images: updatedImages,
      categories: updatedCategories
    })

    setHasUnsavedChanges(true)
    setSelectedImages(new Set())
    setShowBatchActions(false)
  }

  const handleDeleteImage = async (imageFilename: string) => {
    if (!config) return
    
    if (!confirm(`Are you sure you want to delete "${imageFilename}"? This action cannot be undone.`)) {
      return
    }

    try {
      // Delete from R2 storage first
      const imageKey = `images/${imageFilename}`
      const deleteSuccess = await deleteFile(imageKey)
      
      if (!deleteSuccess) {
        alert('Failed to delete image from storage. Please try again.')
        return
      }

      // Remove from configuration
      const updatedImages = { ...config.images }
      const updatedCategories = config.categories.map(category => ({
        ...category,
        images: category.images.filter(img => img !== imageFilename)
      }))

      // Remove the image
      delete updatedImages[imageFilename]

      const updatedConfig = {
        ...config,
        images: updatedImages,
        categories: updatedCategories
      }

      updateConfig({
        images: updatedImages,
        categories: updatedCategories
      })

      // Pass the updated config directly to ensure it's saved
      console.log('Saving updated config after single image deletion:', {
        deletedImage: imageFilename,
        remainingImages: Object.keys(updatedImages).length,
        categories: updatedCategories.map(cat => ({ id: cat.id, imageCount: cat.images.length }))
      })
      const saveSuccess = await saveConfiguration(updatedConfig)
      
      if (saveSuccess) {
        console.log('Configuration saved successfully after single image deletion')
      } else {
        console.error('Failed to save configuration after single image deletion')
        alert('Image deleted from storage but failed to update configuration. Please refresh the page.')
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image. Please try again.')
    }
  }

  const handleBatchDelete = async () => {
    if (!config || selectedImages.size === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedImages.size} images? This action cannot be undone.`)) {
      return
    }

    try {
      // Delete from R2 storage first
      const imageKeys = Array.from(selectedImages).map(filename => `images/${filename}`)
      const deleteResults = await deleteFiles(imageKeys)
      
      if (deleteResults.failed.length > 0) {
        const failedFilenames = deleteResults.failed.map((f: { key: string, error: string }) => f.key.replace('images/', ''))
        alert(`Failed to delete some images from storage: ${failedFilenames.join(', ')}`)
        return
      }

      // Remove from configuration
      const updatedImages = { ...config.images }
      const updatedCategories = config.categories.map(category => ({
        ...category,
        images: category.images.filter(img => !selectedImages.has(img))
      }))

      // Remove selected images
      selectedImages.forEach(imageFilename => {
        delete updatedImages[imageFilename]
      })

      const updatedConfig = {
        ...config,
        images: updatedImages,
        categories: updatedCategories
      }

      updateConfig({
        images: updatedImages,
        categories: updatedCategories
      })

      // Pass the updated config directly to ensure it's saved
      console.log('Saving updated config after batch deletion:', {
        deletedImages: Array.from(selectedImages),
        remainingImages: Object.keys(updatedImages).length,
        categories: updatedCategories.map(cat => ({ id: cat.id, imageCount: cat.images.length }))
      })
      const saveSuccess = await saveConfiguration(updatedConfig)
      
      if (saveSuccess) {
        console.log('Configuration saved successfully after batch deletion')
      } else {
        console.error('Failed to save configuration after batch deletion')
        alert('Images deleted from storage but failed to update configuration. Please refresh the page.')
      }
      
      setSelectedImages(new Set())
      setShowBatchActions(false)
    } catch (error) {
      console.error('Error deleting images:', error)
      alert('Failed to delete images. Please try again.')
    }
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
      
      {/* Upload Success Message */}
      {uploadSuccess && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem',
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          color: '#155724',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          <strong>{uploadSuccess}</strong>
        </div>
      )}

      {/* Save Success Message */}
      {saveSuccess && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem',
          backgroundColor: '#d4edda', 
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          color: '#155724',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span>
          <strong>{saveSuccess}</strong>
        </div>
      )}
      
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
                  value={selectedCategory === 'all' ? 'uncategorized' : selectedCategory}
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
              Back to Image Library
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
                  {hasUnsavedChanges && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      fontSize: '0.8rem', 
                      color: '#dc3545',
                      fontWeight: 'normal'
                    }}>
                      • Unsaved changes
                    </span>
                  )}
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
            <div style={{ display: 'flex', gap: '1rem' }}>
              {hasUnsavedChanges && (
                <button 
                  className="btn btn-success"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  style={{
                    backgroundColor: '#28a745',
                    borderColor: '#28a745'
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
              <button 
                className="btn" 
                onClick={() => setShowUploader(true)}
              >
                Upload New Images
              </button>
            </div>
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
                className="btn btn-warning"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#212529' }}
                onClick={() => handleBatchFeaturedToggle(true)}
              >
                ⭐ Mark as Featured
              </button>
              <button 
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                onClick={() => handleBatchFeaturedToggle(false)}
              >
                Remove Featured
              </button>
              <button 
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                onClick={handleBatchDelete}
              >
                Delete Selected
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* Caption input removed - no longer needed */}
              </div>
            </div>
          )}
          
          {filteredImages.length > 0 ? (
            <>
              <div className="grid grid-3" style={{ gap: '2rem' }}>
                {filteredImages.map((image) => {
                  const isSelected = selectedImages.has(image.filename)
                  
                  return (
                    <div 
                      key={image.filename} 
                      className="image-card" 
                      style={{
                        border: `2px solid ${isSelected ? '#28a745' : '#e0e0e0'}`,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#fff',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img 
                          src={image.url} 
                          alt={image.filename}
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
                        {/* Featured star indicator and toggle */}
                        <div style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '4px',
                          padding: '0.25rem'
                        }}>
                          <button
                            onClick={() => handleFeaturedToggle(image.filename, !image.is_featured)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              padding: '0.25rem',
                              borderRadius: '4px',
                              color: image.is_featured ? '#ffc107' : '#ccc',
                              transition: 'color 0.2s ease'
                            }}
                            title={image.is_featured ? 'Remove from featured' : 'Mark as featured'}
                            onMouseOver={(e) => {
                              e.currentTarget.style.color = '#ffc107'
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.color = image.is_featured ? '#ffc107' : '#ccc'
                            }}
                          >
                            ⭐
                          </button>
                        </div>
                      </div>
                    
                      <div style={{ padding: '1rem' }}>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <strong>{image.filename}</strong>
                              {image.is_featured && (
                                <span style={{ 
                                  marginLeft: '0.5rem', 
                                  fontSize: '0.8rem', 
                                  color: '#ffc107',
                                  fontWeight: 'bold'
                                }}>
                                  ⭐ Featured
                                </span>
                              )}
                              <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                                Uploaded: {new Date(image.uploadDate).toLocaleDateString()}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                {selectedCategory !== 'all' && selectedCategory !== 'uncategorized' ? (
                                  <>Order in {config?.categories.find(cat => cat.id === selectedCategory)?.name}: {getCategoryOrder(image, selectedCategory)}</>
                                ) : (
                                  <>Global Order: {image.order}</>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                <CategoryTags
                                  categories={image.categories}
                                  availableCategories={config?.categories || []}
                                  onCategoriesChange={(newCategories) => handleCategoriesChange(image.filename, newCategories)}
                                />
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
                        
                        {/* Delete button */}
                        <div style={{ marginTop: '1rem' }}>
                          <button
                            onClick={() => handleDeleteImage(image.filename)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: 'bold'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#c82333'
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc3545'
                            }}
                          >
                            🗑️ Delete Image
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
    </div>
  )
}

export default ImageLibrary