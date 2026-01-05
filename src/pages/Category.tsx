import { useState, useEffect } from 'react'
import Gallery from '../components/Gallery'
import LoadingSpinner from '../components/LoadingSpinner'
import { loadPortfolioConfig, CategoryConfig } from '../utils/config'
import { constructImageUrl } from '../utils/cloudflare'

interface CategoryProps {
  category: string
}

const Category = ({ category }: CategoryProps) => {
  const [categoryData, setCategoryData] = useState<CategoryConfig | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCategoryData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const portfolioConfig = await loadPortfolioConfig()
        
        // Find the category data
        const foundCategory = portfolioConfig.categories.find(cat => cat.id === category)
        if (!foundCategory) {
          setError(`Category "${category}" not found`)
          return
        }
        
        setCategoryData(foundCategory)
        
        // Build image URLs from the category's image list, sorted by category-specific order
        const imageData = foundCategory.images.map(imageName => {
          const imageConfig = portfolioConfig.images[imageName]
          if (imageConfig) {
            return {
              filename: imageName,
              url: constructImageUrl(imageConfig.filename),
              categoryOrder: imageConfig.categoryOrders?.[category] ?? imageConfig.order,
              globalOrder: imageConfig.order
            }
          }
          return null
        }).filter(Boolean) as Array<{
          filename: string
          url: string
          categoryOrder: number
          globalOrder: number
        }>
        
        // Sort by category-specific order, fallback to global order
        imageData.sort((a, b) => {
          // Use category-specific order if available, otherwise fall back to global order
          return a.categoryOrder - b.categoryOrder
        })
        
        // Extract just the URLs for the Gallery component
        const imageUrls = imageData.map(item => item.url)
        
        setImages(imageUrls)
        
      } catch (err) {
        console.error('Failed to load category data:', err)
        setError('Failed to load category data')
      } finally {
        setLoading(false)
      }
    }

    loadCategoryData()
  }, [category])

  if (loading) {
    return (
      <div className="category-page">
        <LoadingSpinner message={`Loading ${category}...`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="category-page">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  if (!categoryData) {
    return (
      <div className="category-page">
        <div className="error">Category not found</div>
      </div>
    )
  }

  return (
    <div className="category-page">
      {images.length > 0 ? (
        <Gallery images={images} category={category} />
      ) : (
        <div className="no-images">No images available in this category</div>
      )}
    </div>
  )
}

export default Category