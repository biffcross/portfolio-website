import { useState, useEffect } from 'react'
import { loadPortfolioConfig, PortfolioConfig } from '../utils/config'

const Contact = () => {
  const [config, setConfig] = useState<PortfolioConfig | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const portfolioConfig = await loadPortfolioConfig()
        setConfig(portfolioConfig)
      } catch (error) {
        console.error('Failed to load portfolio config:', error)
      }
    }
    loadConfig()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitMessage('')

    try {
      // Create mailto link with form data
      const subject = encodeURIComponent(formData.subject || 'Photography Inquiry')
      const body = encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
      )
      const mailtoLink = `mailto:${config?.site.email || 'biffcross@hotmail.co.uk'}?subject=${subject}&body=${body}`
      
      // Open email client
      window.location.href = mailtoLink
      
      setSubmitMessage('Email client opened. Thank you for your inquiry!')
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      })
    } catch (error) {
      setSubmitMessage('There was an error processing your request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="contact-page">
      <h1>Contact</h1>
      <div className="contact-content">
        <p style={{ color: '#ccc', fontSize: '1.1rem', marginBottom: '2rem', textAlign: 'center' }}>
          Get in touch for photography services, collaborations, and inquiries.
        </p>
        
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="Your full name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="your.email@example.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder="Photography inquiry, collaboration, etc."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="message">Message *</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              required
              placeholder="Tell me about your project, event, or inquiry..."
            />
          </div>
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
          
          {submitMessage && (
            <div className={`submit-message ${submitMessage.includes('error') ? 'error' : 'success'}`}>
              {submitMessage}
            </div>
          )}
        </form>
        
        <div className="contact-info">
          <h3>Get In Touch</h3>
          <p>
            <strong>Email:</strong> <a href={`mailto:${config?.site.email || 'biffcross@hotmail.co.uk'}`}>
              {config?.site.email || 'biffcross@hotmail.co.uk'}
            </a>
          </p>
          <p>
            <strong>Instagram:</strong> {config?.site.instagram && (
              <a href={config.site.instagram} target="_blank" rel="noopener noreferrer">
                @{config.site.instagram.split('/').pop()}
              </a>
            )}
          </p>
          <p>
            <strong>Services:</strong> Sports Photography, Music Photography, Portraiture, Editorial, Film Photography
          </p>
          <p>
            <strong>Location:</strong> Available for shoots worldwide
          </p>
        </div>
      </div>
    </div>
  )
}

export default Contact