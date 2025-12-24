import { useState, useEffect } from 'react'
import Gallery from '../components/Gallery'
import { loadPortfolioConfig } from '../utils/config'
import { constructImageUrl } from '../utils/cloudflare'

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
        
        // Get images marked as featured
        const featured: string[] = []
        Object.values(portfolioConfig.images).forEach(imageConfig => {
          if (imageConfig.is_featured) {
            featured.push(constructImageUrl(imageConfig.filename))
          }
        })
        
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
        <div className="loading-message">Loading...</div>
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