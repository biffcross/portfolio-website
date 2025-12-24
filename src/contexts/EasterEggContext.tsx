import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { loadPortfolioConfig, EasterEggConfig } from '../utils/config';

export interface EasterEggState {
  konamiCodeActivated: boolean;
  xrayModeActive: boolean;
  fireworksEnabled: boolean;
  christmasOverride: boolean;
}

interface EasterEggContextType extends EasterEggState {
  // Konami code controls
  activateKonamiCode: () => void;
  deactivateKonamiCode: () => void;
  resetKonamiSequence: () => void;
  
  // X-ray mode controls
  toggleXrayMode: (enabled: boolean) => void;
  
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
    xrayModeActive: false,
    fireworksEnabled: false,
    christmasOverride: false
  });

  // Use Konami code hook
  const {
    isKonamiActivated,
    activateKonamiCode: activateKonami,
    deactivateKonamiCode: deactivateKonami,
    resetSequence
  } = useKonamiCode();

  // Load configuration
  const loadConfiguration = async () => {
    try {
      const config = await loadPortfolioConfig();
      
      setEasterEggState(prev => ({
        ...prev,
        fireworksEnabled: config.easterEggs?.fireworksEnabled || false,
        christmasOverride: config.easterEggs?.christmasOverride || false
      }));
    } catch (error) {
      console.error('Failed to load easter egg configuration:', error);
      // Use fallback empty state
      setEasterEggState(prev => ({
        ...prev,
        fireworksEnabled: false,
        christmasOverride: false
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

  // Auto-activate X-ray mode when Konami code is activated
  useEffect(() => {
    if (isKonamiActivated) {
      setEasterEggState(prev => ({
        ...prev,
        xrayModeActive: !prev.xrayModeActive
      }));
    }
  }, [isKonamiActivated]);

  // Context methods
  const activateKonamiCode = () => {
    activateKonami();
  };

  const deactivateKonamiCode = () => {
    deactivateKonami();
    setEasterEggState(prev => ({
      ...prev,
      xrayModeActive: false
    }));
  };

  const resetKonamiSequence = () => {
    resetSequence();
  };

  const toggleXrayMode = (enabled: boolean) => {
    setEasterEggState(prev => ({
      ...prev,
      xrayModeActive: enabled
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
    toggleXrayMode,
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