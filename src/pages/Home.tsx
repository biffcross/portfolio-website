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
        
        // Get featured images from all categories (first 3 images from each category that has images)
        const featured: string[] = []
        portfolioConfig.categories.forEach(category => {
          if (category.images.length > 0) {
            // Take up to 3 images from each category for the featured gallery
            const imagesToTake = Math.min(3, category.images.length)
            for (let i = 0; i < imagesToTake; i++) {
              const imageName = category.images[i]
              const imageConfig = portfolioConfig.images[imageName]
              if (imageConfig) {
                featured.push(constructImageUrl(imageConfig.filename))
              }
            }
          }
        })
        
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
          <p>No images available</p>
        </div>
      )}
    </div>
  )
}

export default Home