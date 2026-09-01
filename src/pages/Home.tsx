import { useState, useEffect } from 'react'
import Gallery from '../components/Gallery'
import LoadingSpinner from '../components/LoadingSpinner'
import { loadPortfolioConfig } from '../utils/config'
import type { ImageConfig } from '../utils/config'
import { constructImageUrl } from '../utils/cloudflare'

// Rank used to order the featured (home page) gallery. Prefers the
// admin-managed `featuredOrder`, falls back to the global `order` for configs
// saved before that field existed, and sorts anything non-numeric to the end
// rather than producing NaN comparisons.
const getFeaturedRank = (imageConfig: ImageConfig): number => {
  const { featuredOrder, order } = imageConfig

  if (typeof featuredOrder === 'number' && Number.isFinite(featuredOrder)) {
    return featuredOrder
  }
  if (typeof order === 'number' && Number.isFinite(order)) {
    return order
  }
  return Number.MAX_SAFE_INTEGER
}

const Home = () => {
  const [featuredImages, setFeaturedImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFeaturedImages = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const portfolioConfig = await loadPortfolioConfig()
        
        // Get images marked as featured, ordered by the sequence set in the
        // admin app's Featured view.
        const featured: string[] = Object.values(portfolioConfig.images)
          .filter(imageConfig => imageConfig.is_featured)
          .sort((a, b) => getFeaturedRank(a) - getFeaturedRank(b))
          .map(imageConfig => constructImageUrl(imageConfig.filename))
        
        // If no images are marked as featured, fall back to first few images from categories
        if (featured.length === 0) {
          portfolioConfig.categories.forEach(category => {
            if (category.images.length > 0) {
              // Get all images in this category with their ordering information
              const categoryImageData = category.images.map(imageName => {
                const imageConfig = portfolioConfig.images[imageName]
                if (imageConfig) {
                  return {
                    filename: imageName,
                    url: constructImageUrl(imageConfig.filename),
                    categoryOrder: imageConfig.categoryOrders?.[category.id] ?? imageConfig.order
                  }
                }
                return null
              }).filter(Boolean) as Array<{
                filename: string
                url: string
                categoryOrder: number
              }>
              
              // Sort by category-specific order
              categoryImageData.sort((a, b) => a.categoryOrder - b.categoryOrder)
              
              // Take up to 3 images from each category for the featured gallery as fallback
              const imagesToTake = Math.min(3, categoryImageData.length)
              for (let i = 0; i < imagesToTake; i++) {
                featured.push(categoryImageData[i].url)
              }
            }
          })
        }
        
        setFeaturedImages(featured)
        
      } catch (err) {
        console.error('Failed to load featured images:', err)
        setError('Failed to load portfolio data')
      } finally {
        setLoading(false)
      }
    }

    loadFeaturedImages()
  }, [])

  if (loading) {
    return (
      <div className="home-page">
        <LoadingSpinner message="Loading portfolio..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-page">
        <div className="error-message">Error loading portfolio</div>
      </div>
    )
  }

  return (
    <div className="home-page">
      {featuredImages.length > 0 ? (
        <Gallery images={featuredImages} />
      ) : (
        <div className="no-images">
          <p>No featured images available</p>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            Images can be marked as featured through the admin interface
          </p>
        </div>
      )}
    </div>
  )
}

export default Home