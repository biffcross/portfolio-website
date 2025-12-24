import React, { useEffect } from 'react';
import './XrayMode.css';

interface XrayModeProps {
  isActive: boolean;
}

const XrayMode: React.FC<XrayModeProps> = ({ isActive }) => {
  useEffect(() => {
    if (isActive) {
      document.body.classList.add('xray-mode');
      
      // Add a subtle activation sound (if audio is supported)
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        // Audio not supported or blocked, continue silently
      }
    } else {
      document.body.classList.remove('xray-mode');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('xray-mode');
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="xray-overlay">
      <div className="xray-indicator">
        <div className="xray-icon">🔬</div>
        <div className="xray-text">X-RAY MODE</div>
      </div>
    </div>
  );
};

export default XrayMode;