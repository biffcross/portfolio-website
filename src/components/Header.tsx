import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ShareButton from './ShareButton'
import { loadPortfolioConfig, PortfolioConfig, CategoryConfig } from '../utils/config'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [config, setConfig] = useState<PortfolioConfig | null>(null)
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const location = useLocation()

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const portfolioConfig = await loadPortfolioConfig()
        setConfig(portfolioConfig)
        setCategories(portfolioConfig.categories)
      } catch (error) {
        console.error('Failed to load portfolio config:', error)
        // Fallback to hardcoded categories if config fails
        setCategories([
          { id: 'sports', name: 'Sports', description: 'Sports photography', images: [] },
          { id: 'music', name: 'Music', description: 'Music photography', images: [] },
          { id: 'portraiture', name: 'Portraiture', description: 'Portrait photography', images: [] },
          { id: 'analogue', name: 'Analogue', description: 'Film photography', images: [] },
          { id: 'editorial', name: 'Editorial', description: 'Editorial photography', images: [] }
        ])
      }
    }
    loadConfig()
  }, [])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const isActiveLink = (path: string) => {
    return location.pathname === path
  }

  // Get current page name for mobile display
  const getCurrentPageName = () => {
    if (location.pathname === '/') return 'Home'
    if (location.pathname === '/about') return 'About'
    if (location.pathname === '/contact') return 'Contact'
    
    const category = categories.find(cat => location.pathname === `/${cat.id}`)
    return category ? category.name : 'Portfolio'
  }

  return (
    <header className="header">
      <nav className="nav">
        <Link to="/" className="brand" onClick={closeMenu}>
          <div className="brand-text">
            <div className="brand-name">Biff Cross</div>
            <div className="brand-type">[Photography]</div>
          </div>
        </Link>
        
        <div className="mobile-nav-info">
          <div className="current-page-mobile">{getCurrentPageName()}</div>
          <button 
            className={`hamburger ${isMenuOpen ? 'hamburger--active' : ''}`}
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className={`nav-menu ${isMenuOpen ? 'nav-menu--active' : ''}`}>
          <ul className="nav-links">
            <li>
              <Link 
                to="/" 
                className={isActiveLink('/') ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={closeMenu}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                to="/about" 
                className={isActiveLink('/about') ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={closeMenu}
              >
                About
              </Link>
            </li>
            {categories.map(category => (
              <li key={category.id}>
                <Link 
                  to={`/${category.id}`} 
                  className={isActiveLink(`/${category.id}`) ? 'nav-link nav-link--active' : 'nav-link'}
                  onClick={closeMenu}
                >
                  {category.name}
                </Link>
              </li>
            ))}
            <li>
              <Link 
                to="/contact" 
                className={isActiveLink('/contact') ? 'nav-link nav-link--active' : 'nav-link'}
                onClick={closeMenu}
              >
                Contact
              </Link>
            </li>
          </ul>
          
          <div className="nav-actions">
            {config?.site.instagram && (
              <a 
                href={config.site.instagram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="instagram-link"
                onClick={closeMenu}
              >
                Instagram
              </a>
            )}
            <ShareButton />
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Header