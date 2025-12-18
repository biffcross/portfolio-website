import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { loadPortfolioConfig, EasterEggConfig } from '../utils/config';

export interface EasterEggState {
  konamiCodeActivated: boolean;
  fallingImagesActive: boolean;
  fireworksEnabled: boolean;
  gameScore: number;
  christmasOverride: boolean;
  portfolioImages: string[];
}

interface EasterEggContextType extends EasterEggState {
  // Konami code controls
  activateKonamiCode: () => void;
  deactivateKonamiCode: () => void;
  resetKonamiSequence: () => void;
  
  // Falling images game controls
  startFallingImagesGame: () => void;
  stopFallingImagesGame: () => void;
  updateGameScore: (score: number) => void;
  
  // Fireworks controls
  toggleFireworks: (enabled: boolean) => void;
  
  // Christmas override controls
  toggleChristmasOverride: (enabled: boolean) => void;
  
  // Configuration
  updateEasterEggConfig: (config: Partial<EasterEggConfig>) => void;
  refreshConfiguration: () => Promise<void>;
}

const EasterEggContext = createContext<EasterEggContextType | undefined>(undefined);

interface EasterEggProviderProps {
  children: ReactNode;
}

export const EasterEggProvider: React.FC<EasterEggProviderProps> = ({ children }) => {
  const [easterEggState, setEasterEggState] = useState<EasterEggState>({
    konamiCodeActivated: false,
    fallingImagesActive: false,
    fireworksEnabled: false,
    gameScore: 0,
    christmasOverride: false,
    portfolioImages: []
  });

  // Use Konami code hook
  const {
    isKonamiActivated,
    activateKonamiCode: activateKonami,
    deactivateKonamiCode: deactivateKonami,
    resetSequence
  } = useKonamiCode();

  // Load configuration and portfolio images
  const loadConfiguration = async () => {
    try {
      const config = await loadPortfolioConfig();
      
      // Extract all image filenames from categories
      const allImages = config.categories.reduce<string[]>((acc, category) => {
        return [...acc, ...category.images];
      }, []);
      
      setEasterEggState(prev => ({
        ...prev,
        fireworksEnabled: config.easterEggs?.fireworksEnabled || false,
        christmasOverride: config.easterEggs?.christmasOverride || false,
        portfolioImages: allImages
      }));
    } catch (error) {
      console.error('Failed to load easter egg configuration:', error);
      // Use fallback empty state
      setEasterEggState(prev => ({
        ...prev,
        fireworksEnabled: false,
        christmasOverride: false,
        portfolioImages: []
      }));
    }
  };

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  // Sync Konami code state
  useEffect(() => {
    setEasterEggState(prev => ({
      ...prev,
      konamiCodeActivated: isKonamiActivated
    }));
  }, [isKonamiActivated]);

  // Auto-start falling images game when Konami code is activated
  useEffect(() => {
    if (isKonamiActivated && !easterEggState.fallingImagesActive) {
      setEasterEggState(prev => ({
        ...prev,
        fallingImagesActive: true,
        gameScore: 0
      }));
    }
  }, [isKonamiActivated, easterEggState.fallingImagesActive]);

  // Context methods
  const activateKonamiCode = () => {
    activateKonami();
  };

  const deactivateKonamiCode = () => {
    deactivateKonami();
    setEasterEggState(prev => ({
      ...prev,
      fallingImagesActive: false,
      gameScore: 0
    }));
  };

  const resetKonamiSequence = () => {
    resetSequence();
  };

  const startFallingImagesGame = () => {
    setEasterEggState(prev => ({
      ...prev,
      fallingImagesActive: true,
      gameScore: 0
    }));
  };

  const stopFallingImagesGame = () => {
    setEasterEggState(prev => ({
      ...prev,
      fallingImagesActive: false
    }));
  };

  const updateGameScore = (score: number) => {
    setEasterEggState(prev => ({
      ...prev,
      gameScore: score
    }));
  };

  const toggleFireworks = (enabled: boolean) => {
    setEasterEggState(prev => ({
      ...prev,
      fireworksEnabled: enabled
    }));
  };

  const toggleChristmasOverride = (enabled: boolean) => {
    setEasterEggState(prev => ({
      ...prev,
      christmasOverride: enabled
    }));
  };

  const updateEasterEggConfig = (config: Partial<EasterEggConfig>) => {
    setEasterEggState(prev => ({
      ...prev,
      ...config
    }));
  };

  const refreshConfiguration = async () => {
    await loadConfiguration();
  };

  const contextValue: EasterEggContextType = {
    ...easterEggState,
    activateKonamiCode,
    deactivateKonamiCode,
    resetKonamiSequence,
    startFallingImagesGame,
    stopFallingImagesGame,
    updateGameScore,
    toggleFireworks,
    toggleChristmasOverride,
    updateEasterEggConfig,
    refreshConfiguration
  };

  return (
    <EasterEggContext.Provider value={contextValue}>
      {children}
    </EasterEggContext.Provider>
  );
};

export const useEasterEgg = (): EasterEggContextType => {
  const context = useContext(EasterEggContext);
  if (context === undefined) {
    throw new Error('useEasterEgg must be used within an EasterEggProvider');
  }
  return context;
};

export default EasterEggContext;