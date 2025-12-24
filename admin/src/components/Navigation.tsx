import { Link, useLocation } from 'react-router-dom'
import './Navigation.css'

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link'
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <div className="brand-name">Biff Cross</div>
          <div className="brand-type">[Admin]</div>
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className={isActive('/')}>
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/images" className={isActive('/images')}>
              Image Library
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/categories" className={isActive('/categories')}>
              Categories
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/easter-eggs" className={isActive('/easter-eggs')}>
              Easter Eggs
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navigation