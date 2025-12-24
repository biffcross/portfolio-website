import { ReactNode } from 'react'
import Navigation from './Navigation'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout