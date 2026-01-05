import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Category from './pages/Category'
import LoadingSpinner from './components/LoadingSpinner'
import ChristmasCurtains from './components/ChristmasCurtains'
import XrayMode from './components/XrayMode'
import FireworksEffect from './components/FireworksEffect'
import { ChristmasProvider, useChristmas } from './contexts/ChristmasContext'
import { EasterEggProvider, useEasterEgg } from './contexts/EasterEggContext'
import { loadPortfolioConfig, CategoryConfig } from './utils/config'
import './App.css'

// Main App Content Component (wrapped by providers)
function AppContent() {
  const [categories, setCategories] = useState<CategoryConfig[]>([])
  const [loading, setLoading] = useState(true)
  const { shouldShowCurtains, hideCurtains } = useChristmas()
  const { 
    xrayModeActive, 
    fireworksEnabled
  } = useEasterEgg()

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const config = await loadPortfolioConfig()
        setCategories(config.categories)
      } catch (error) {
        console.error('Failed to load categories:', error)
        // Fallback to hardcoded categories if config fails
        setCategories([
          { id: 'sports', name: 'Sports', description: 'Sports photography', images: [] },
          { id: 'music', name: 'Music', description: 'Music photography', images: [] },
          { id: 'portraiture', name: 'Portraiture', description: 'Portrait photography', images: [] },
          { id: 'analogue', name: 'Analogue', description: 'Film photography', images: [] },
          { id: 'editorial', name: 'Editorial', description: 'Editorial photography', images: [] }
        ])
      } finally {
        setLoading(false)
      }
    }
    loadCategories()
  }, [])

  if (loading) {
    return (
      <div className="App">
        <LoadingSpinner size="large" message="Loading application..." />
      </div>
    )
  }

  return (
    <Router>
      <div className="App">
        {/* Christmas Curtains Overlay */}
        <ChristmasCurtains 
          isVisible={shouldShowCurtains} 
          onHide={hideCurtains}
        />
        
        {/* Easter Egg Features */}
        <XrayMode
          isActive={xrayModeActive}
        />
        
        <FireworksEffect
          isEnabled={fireworksEnabled}
        />
        
        {/* Main Portfolio Content */}
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            {categories.map(category => (
              <Route 
                key={category.id}
                path={`/${category.id}`} 
                element={<Category category={category.id} />} 
              />
            ))}
          </Routes>
        </main>
      </div>
    </Router>
  )
}

// Root App Component with Providers
function App() {
  return (
    <ChristmasProvider>
      <EasterEggProvider>
        <AppContent />
      </EasterEggProvider>
    </ChristmasProvider>
  )
}

export default App