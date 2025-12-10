import React, { useState, useEffect } from 'react';
import ChristmasCountdown from './ChristmasCountdown';
import './ChristmasCurtains.css';

interface ChristmasCurtainsProps {
  isVisible: boolean;
  onHide?: () => void;
}

const ChristmasCurtains: React.FC<ChristmasCurtainsProps> = ({ isVisible }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      // Small delay to ensure the component is rendered before animation
      setTimeout(() => setIsAnimating(true), 50);
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div 
      className={`christmas-curtains ${isAnimating ? 'visible' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left Curtain */}
      <div className="curtain curtain-left">
        <div className="curtain-fabric">
          <div className="curtain-pattern"></div>
          <div className="curtain-fold"></div>
          <div className="curtain-fold"></div>
          <div className="curtain-fold"></div>
        </div>
        <div className="curtain-tassel"></div>
      </div>

      {/* Right Curtain */}
      <div className="curtain curtain-right">
        <div className="curtain-fabric">
          <div className="curtain-pattern"></div>
          <div className="curtain-fold"></div>
          <div className="curtain-fold"></div>
          <div className="curtain-fold"></div>
        </div>
        <div className="curtain-tassel"></div>
      </div>

      {/* Curtain Rod */}
      <div className="curtain-rod">
        <div className="rod-finial rod-finial-left"></div>
        <div className="rod-finial rod-finial-right"></div>
      </div>

      {/* Content Area */}
      <div className="curtains-content">
        <div className="content-wrapper">
          <h1 className="christmas-title">
            🎄 Merry Christmas! 🎄
          </h1>
          <p className="christmas-message">
            The portfolio will be revealed on Christmas Day!
          </p>
          <ChristmasCountdown className="curtains-countdown" />
          <div className="christmas-scene">
            <div className="snow-container">
              {Array.from({ length: 50 }, (_, i) => (
                <div 
                  key={i} 
                  className="snowflake" 
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${3 + Math.random() * 2}s`
                  }}
                >
                  ❄
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Background overlay to prevent interaction */}
      <div className="curtains-overlay"></div>
    </div>
  );
};

export default ChristmasCurtains;