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
                aria-label="Instagram"
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
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