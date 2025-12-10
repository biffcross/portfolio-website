import { useState } from 'react'

interface ShareButtonProps {
  url?: string
  title?: string
  description?: string
}

const ShareButton = ({ 
  url = window.location.href, 
  title = 'Biff Cross Photography',
  description = 'Professional photography portfolio showcasing sports, music, portraiture, and editorial work'
}: ShareButtonProps) => {
  const [showModal, setShowModal] = useState(false)

  const handleShare = async () => {
    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        })
      } catch (error) {
        // User cancelled or error occurred, don't show fallback
        console.log('Web Share cancelled or failed:', error)
      }
    } else {
      // Fallback to custom modal
      setShowModal(true)
    }
  }

  const closeModal = () => {
    setShowModal(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      // Could add a toast notification here
      closeModal()
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      closeModal()
    }
  }

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(facebookUrl, '_blank', 'width=600,height=400')
    closeModal()
  }

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
    window.open(twitterUrl, '_blank', 'width=600,height=400')
    closeModal()
  }

  const shareToLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    window.open(linkedInUrl, '_blank', 'width=600,height=400')
    closeModal()
  }

  const shareViaEmail = () => {
    const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check out this amazing photography portfolio: ${url}`)}`
    window.location.href = emailUrl
    closeModal()
  }

  return (
    <>
      <button onClick={handleShare} className="share-button">
        Share
      </button>

      {showModal && (
        <div className="share-modal-overlay" onClick={closeModal}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal__header">
              <h3>Share Portfolio</h3>
              <button 
                className="share-modal__close" 
                onClick={closeModal}
                aria-label="Close share modal"
              >
                ×
              </button>
            </div>
            
            <div className="share-modal__content">
              <div className="share-options">
                <button 
                  className="share-option share-option--facebook"
                  onClick={shareToFacebook}
                >
                  <span className="share-option__icon">📘</span>
                  Facebook
                </button>
                
                <button 
                  className="share-option share-option--twitter"
                  onClick={shareToTwitter}
                >
                  <span className="share-option__icon">🐦</span>
                  Twitter
                </button>
                
                <button 
                  className="share-option share-option--linkedin"
                  onClick={shareToLinkedIn}
                >
                  <span className="share-option__icon">💼</span>
                  LinkedIn
                </button>
                
                <button 
                  className="share-option share-option--email"
                  onClick={shareViaEmail}
                >
                  <span className="share-option__icon">📧</span>
                  Email
                </button>
                
                <button 
                  className="share-option share-option--copy"
                  onClick={copyToClipboard}
                >
                  <span className="share-option__icon">🔗</span>
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ShareButton