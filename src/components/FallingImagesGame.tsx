import React, { useState, useEffect, useCallback } from 'react';
import FallingImage, { FallingImageData } from './FallingImage';
import { constructImageUrl } from '../utils/cloudflare';
import './FallingImagesGame.css';

interface FallingImagesGameProps {
  isActive: boolean;
  portfolioImages: string[]; // Array of image filenames
  onScoreChange?: (score: number) => void;
  onGameEnd?: () => void;
}

const FallingImagesGame: React.FC<FallingImagesGameProps> = ({
  isActive,
  portfolioImages,
  onScoreChange,
  onGameEnd
}) => {
  const [fallingImages, setFallingImages] = useState<FallingImageData[]>([]);
  const [score, setScore] = useState(0);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);

  // Game configuration
  const SPAWN_INTERVAL = 2000; // Spawn new image every 2 seconds
  const MIN_SPEED = 2;
  const MAX_SPEED = 5;
  const MIN_SIZE = 60;
  const MAX_SIZE = 120;
  const GAME_DURATION = 30000; // 30 seconds

  // Generate random falling image data
  const createFallingImage = useCallback((): FallingImageData => {
    const randomImage = portfolioImages[Math.floor(Math.random() * portfolioImages.length)];
    
    return {
      id: `falling-${Date.now()}-${Math.random()}`,
      imageUrl: constructImageUrl(randomImage),
      x: Math.random() * 85, // 0-85% to keep images on screen
      y: -100, // Start above screen
      speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
      rotation: Math.random() * 360,
      size: MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE)
    };
  }, [portfolioImages]);

  // Handle image catch
  const handleImageCatch = useCallback((imageId: string) => {
    setFallingImages(prev => prev.filter(img => img.id !== imageId));
    setScore(prev => {
      const newScore = prev + 1;
      onScoreChange?.(newScore);
      return newScore;
    });
  }, [onScoreChange]);

  // Handle image miss (fell off screen)
  const handleImageMiss = useCallback((imageId: string) => {
    setFallingImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  // Start game
  useEffect(() => {
    if (isActive && portfolioImages.length > 0) {
      setGameStartTime(Date.now());
      setScore(0);
      setFallingImages([]);
      onScoreChange?.(0);
    }
  }, [isActive, portfolioImages.length, onScoreChange]);

  // Game loop - spawn images and manage game duration
  useEffect(() => {
    if (!isActive || !gameStartTime || portfolioImages.length === 0) {
      return;
    }

    // Spawn images interval
    const spawnInterval = setInterval(() => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - gameStartTime;
      
      // Stop spawning if game duration exceeded
      if (elapsedTime >= GAME_DURATION) {
        clearInterval(spawnInterval);
        return;
      }
      
      // Create and add new falling image
      const newImage = createFallingImage();
      setFallingImages(prev => [...prev, newImage]);
    }, SPAWN_INTERVAL);

    // Game duration timer
    const gameTimer = setTimeout(() => {
      setFallingImages([]); // Clear all falling images
      onGameEnd?.();
    }, GAME_DURATION);

    return () => {
      clearInterval(spawnInterval);
      clearTimeout(gameTimer);
    };
  }, [isActive, gameStartTime, portfolioImages.length, createFallingImage, onGameEnd]);

  // Cleanup when game becomes inactive
  useEffect(() => {
    if (!isActive) {
      setFallingImages([]);
      setGameStartTime(null);
    }
  }, [isActive]);

  if (!isActive || portfolioImages.length === 0) {
    return null;
  }

  const timeRemaining = gameStartTime 
    ? Math.max(0, GAME_DURATION - (Date.now() - gameStartTime)) / 1000
    : 0;

  return (
    <div className="falling-images-game">
      {/* Game UI */}
      <div className="game-ui">
        <div className="score">Score: {score}</div>
        <div className="timer">Time: {Math.ceil(timeRemaining)}s</div>
        <div className="instructions">Click the falling images to catch them!</div>
      </div>

      {/* Falling Images */}
      {fallingImages.map(imageData => (
        <FallingImage
          key={imageData.id}
          imageData={imageData}
          onCatch={handleImageCatch}
          onMiss={handleImageMiss}
        />
      ))}
    </div>
  );
};

export default FallingImagesGame;