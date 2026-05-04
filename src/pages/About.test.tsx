import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import About from './About'

describe('About Page', () => {
  it('should render the new bio text about extreme sports photography', () => {
    render(<About />)
    
    // Check for key phrases from the new bio
    expect(screen.getByText(/I am a photographer, from Norwich, England/i)).toBeInTheDocument()
    expect(screen.getByText(/extreme sports such as freestyle skiing, snowboarding, Climbing and skateboarding/i)).toBeInTheDocument()
    expect(screen.getByText(/J. Grant Brittain and Attiba Jefferson/i)).toBeInTheDocument()
    expect(screen.getByText(/LAAX open freeski world cup/i)).toBeInTheDocument()
  })

  it('should display the Biff.jpeg image', () => {
    render(<About />)
    
    const image = screen.getByAltText('Biff Cross')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src')
  })

  it('should have proper layout structure with image and text containers', () => {
    const { container } = render(<About />)
    
    const aboutContainer = container.querySelector('.about-container')
    const aboutImage = container.querySelector('.about-image')
    const aboutText = container.querySelector('.about-text')
    
    expect(aboutContainer).toBeInTheDocument()
    expect(aboutImage).toBeInTheDocument()
    expect(aboutText).toBeInTheDocument()
  })

  it('should format bio text into multiple paragraphs', () => {
    const { container } = render(<About />)
    
    const paragraphs = container.querySelectorAll('.about-text p')
    expect(paragraphs.length).toBeGreaterThanOrEqual(4)
  })

  it('should not display old placeholder content', () => {
    render(<About />)
    
    // Verify old placeholder text is NOT present
    expect(screen.queryByText(/Welcome to my photography portfolio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/professional photographer with a passion for capturing life's most dynamic/i)).not.toBeInTheDocument()
  })
})
