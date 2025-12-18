import React, { useState, useEffect } from 'react';
import './FallingImage.css';

export interface FallingImageData {
  id: string;
  imageUrl: string;
  x: number; // Horizontal position (percentage)
  y: number; // Vertical position (pixels)
  speed: number; // Fall speed (pixels per frame)
  rotation: number; // Image rotation angle (degrees)
  size: number; // Image size (pixels)
}

interface FallingImageProps {
  imageData: FallingImageData;
  onCatch: (id: string) => void;
  onMiss: (id: string) => void;
}

const FallingImage: React.FC<FallingImageProps> = ({ imageData, onCatch, onMiss }) => {
  const [position, setPosition] = useState({ x: imageData.x, y: imageData.y });
  const [rotation, setRotation] = useState(imageData.rotation);

  useEffect(() => {
    const animationFrame = () => {
      setPosition(prev => {
        const newY = prev.y + imageData.speed;
        
        // Check if image has fallen off screen
        if (newY > window.innerHeight + imageData.size) {
          onMiss(imageData.id);
          return prev; // Don't update position if missed
        }
        
        return { ...prev, y: newY };
      });

      // Add slight rotation for visual effect
      setRotation(prev => prev + 0.5);
    };

    const intervalId = setInterval(animationFrame, 16); // ~60fps

    return () => clearInterval(intervalId);
  }, [imageData.id, imageData.speed, imageData.size, onMiss]);

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onCatch(imageData.id);
  };

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}%`,
    top: `${position.y}px`,
    width: `${imageData.size}px`,
    height: `${imageData.size}px`,
    transform: `rotate(${rotation}deg)`,
    cursor: 'pointer',
    zIndex: 9999,
    pointerEvents: 'auto',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.1s ease'
  };

  return (
    <img
      src={imageData.imageUrl}
      alt="Falling portfolio image"
      className="falling-image"
      style={style}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(${rotation}deg) scale(1.1)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${rotation}deg) scale(1)`;
      }}
      draggable={false}
    />
  );
};

export default FallingImage;