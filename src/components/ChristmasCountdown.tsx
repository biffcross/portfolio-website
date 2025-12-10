import React, { useState, useEffect } from 'react';
import { getDaysUntilChristmas, getCurrentUKTime } from '../utils/christmas';
import './ChristmasCountdown.css';

interface ChristmasCountdownProps {
  className?: string;
}

const ChristmasCountdown: React.FC<ChristmasCountdownProps> = ({ className = '' }) => {
  const [daysUntil, setDaysUntil] = useState<number>(0);
  const [, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    // Update countdown immediately
    const updateCountdown = () => {
      const ukTime = getCurrentUKTime();
      setCurrentTime(ukTime);
      setDaysUntil(getDaysUntilChristmas(ukTime));
    };

    // Initial update
    updateCountdown();

    // Set up interval to update every minute
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatDays = (days: number): string => {
    if (days === 0) {
      return "It's Christmas Day!";
    } else if (days === 1) {
      return "1 day until Christmas";
    } else {
      return `${days} days until Christmas`;
    }
  };

  return (
    <div className={`christmas-countdown ${className}`}>
      <div className="countdown-content">
        <h2 className="countdown-title">🎄 Christmas Countdown 🎄</h2>
        <div className="countdown-display">
          <div className="days-number">{daysUntil}</div>
          <div className="days-label">
            {daysUntil === 1 ? 'Day' : 'Days'}
          </div>
        </div>
        <p className="countdown-message">{formatDays(daysUntil)}</p>
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