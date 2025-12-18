import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ImageLibrary from './pages/ImageLibrary'
import CategoryManager from './pages/CategoryManager'
import EasterEggSettings from './pages/EasterEggSettings'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/images" element={<ImageLibrary />} />
          <Route path="/categories" element={<CategoryManager />} />
          <Route path="/easter-eggs" element={<EasterEggSettings />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App