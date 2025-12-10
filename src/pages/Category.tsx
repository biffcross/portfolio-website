import { useState, useEffect } from 'react'
import Gallery from '../components/Gallery'
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
        
        // Build image URLs from the category's image list
        const imageUrls = foundCategory.images.map(imageName => {
          const imageConfig = portfolioConfig.images[imageName]
          if (imageConfig) {
            return constructImageUrl(imageConfig.filename)
          }
          return null
        }).filter(Boolean) as string[]
        
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
        <div className="loading">Loading {category}...</div>
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