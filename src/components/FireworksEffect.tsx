import React, { useState, useEffect, useCallback } from 'react';
import './FireworksEffect.css';

export interface ParticleData {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  life: number; // Remaining animation time (0-1)
  maxLife: number;
  size: number;
}

export interface FireworkData {
  id: string;
  x: number; // Click x coordinate
  y: number; // Click y coordinate
  timestamp: number; // Creation time for animation timing
  particles: ParticleData[];
}

interface FireworksEffectProps {
  isEnabled: boolean;
  onFireworkCreate?: (firework: FireworkData) => void;
}

const FIREWORK_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Light Yellow
  '#BB8FCE', // Light Purple
  '#85C1E9'  // Light Blue
];

const PARTICLE_COUNT = 20;
const PARTICLE_LIFE = 2000; // 2 seconds
const GRAVITY = 0.3;
const FRICTION = 0.98;

const FireworksEffect: React.FC<FireworksEffectProps> = ({ isEnabled, onFireworkCreate }) => {
  const [fireworks, setFireworks] = useState<FireworkData[]>([]);

  // Create particles for a firework
  const createParticles = useCallback((x: number, y: number): ParticleData[] => {
    const particles: ParticleData[] = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
      const velocity = 3 + Math.random() * 4;
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      
      particles.push({
        id: `particle-${Date.now()}-${i}`,
        x,
        y,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        color,
        life: 1,
        maxLife: PARTICLE_LIFE + Math.random() * 1000, // Vary particle life
        size: 2 + Math.random() * 3
      });
    }
    
    return particles;
  }, []);

  // Handle click events to create fireworks
  const handleClick = useCallback((event: MouseEvent) => {
    if (!isEnabled) return;
    
    const x = event.clientX;
    const y = event.clientY;
    
    const newFirework: FireworkData = {
      id: `firework-${Date.now()}`,
      x,
      y,
      timestamp: Date.now(),
      particles: createParticles(x, y)
    };
    
    setFireworks(prev => [...prev, newFirework]);
    onFireworkCreate?.(newFirework);
  }, [isEnabled, createParticles, onFireworkCreate]);

  // Add click event listener
  useEffect(() => {
    if (isEnabled) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [isEnabled, handleClick]);

  // Animation loop for particles
  useEffect(() => {
    if (fireworks.length === 0) return;

    const animationFrame = () => {
      setFireworks(prev => {
        return prev
          .map(firework => ({
            ...firework,
            particles: firework.particles
              .map(particle => {
                const age = Date.now() - firework.timestamp;
                const lifeRatio = Math.max(0, 1 - age / particle.maxLife);
                
                if (lifeRatio <= 0) return null; // Particle died
                
                return {
                  ...particle,
                  x: particle.x + particle.velocityX,
                  y: particle.y + particle.velocityY,
                  velocityX: particle.velocityX * FRICTION,
                  velocityY: particle.velocityY * FRICTION + GRAVITY,
                  life: lifeRatio
                };
              })
              .filter((particle): particle is ParticleData => particle !== null)
          }))
          .filter(firework => firework.particles.length > 0); // Remove fireworks with no particles
      });
    };

    const intervalId = setInterval(animationFrame, 16); // ~60fps
    return () => clearInterval(intervalId);
  }, [fireworks.length]);

  // Clear fireworks when disabled
  useEffect(() => {
    if (!isEnabled) {
      setFireworks([]);
    }
  }, [isEnabled]);

  if (!isEnabled || fireworks.length === 0) {
    return null;
  }

  return (
    <div className="fireworks-container">
      {fireworks.map(firework =>
        firework.particles.map(particle => (
          <div
            key={particle.id}
            className="firework-particle"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              backgroundColor: particle.color,
              opacity: particle.life,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
            }}
          />
        ))
      )}
    </div>
  );
};

export default FireworksEffect;