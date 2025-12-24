import React from 'react';
import './ChristmasCountdown.css';

interface ChristmasCountdownProps {
  className?: string;
}

const ChristmasCountdown: React.FC<ChristmasCountdownProps> = ({ className = '' }) => {
  return (
    <div className={`christmas-countdown ${className}`}>
      <div className="countdown-content">
        <h2 className="countdown-title">🎄 Merry Christmas! 🎄</h2>
        <div className="present-display">
          <div className="present-icon">🎁</div>
        </div>
        <p className="present-message">This is a present to be opened on Christmas Day!</p>
        <div className="christmas-decorations">
          <span className="decoration">🎅</span>
          <span className="decoration">🎁</span>
          <span className="decoration">⭐</span>
          <span className="decoration">🔔</span>
          <span className="decoration">❄️</span>
        </div>
      </div>
    </div>
  );
};

export default ChristmasCountdown;