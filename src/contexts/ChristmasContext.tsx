import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  getChristmasState, 
  shouldShowChristmasCurtains, 
  isJanuary,
  ChristmasState 
} from '../utils/christmas';
import { loadPortfolioConfig } from '../utils/config';

interface ChristmasContextType extends ChristmasState {
  shouldShowCurtains: boolean;
  hideCurtains: () => void;
  isManuallyHidden: boolean;
}

const ChristmasContext = createContext<ChristmasContextType | undefined>(undefined);

interface ChristmasProviderProps {
  children: ReactNode;
}

export const ChristmasProvider: React.FC<ChristmasProviderProps> = ({ children }) => {
  const [christmasState, setChristmasState] = useState<ChristmasState>(() => getChristmasState());
  const [isManuallyHidden, setIsManuallyHidden] = useState(false);
  const [christmasOverride, setChristmasOverride] = useState(false);

  // Load easter egg configuration for Christmas override
  useEffect(() => {
    const loadEasterEggConfig = async () => {
      try {
        const config = await loadPortfolioConfig();
        setChristmasOverride(config.easterEggs?.christmasOverride || false);
      } catch (error) {
        console.error('Failed to load easter egg configuration:', error);
        setChristmasOverride(false);
      }
    };
    
    loadEasterEggConfig();
  }, []);

  useEffect(() => {
    const updateChristmasState = () => {
      const newState = getChristmasState();
      setChristmasState(newState);
      
      // Auto-hide curtains on Christmas Day
      if (newState.isChristmasDay) {
        setIsManuallyHidden(true);
      }
      
      // Reset manual hide state in January
      if (isJanuary(newState.currentUKTime)) {
        setIsManuallyHidden(false);
      }
    };

    // Update immediately
    updateChristmasState();

    // Set up interval to check every minute
    const interval = setInterval(updateChristmasState, 60000);

    // Also check at midnight (more frequent checks around midnight)
    const midnightCheck = setInterval(() => {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Check more frequently around midnight (23:58 - 00:02)
      if ((now.getHours() === 23 && minutes >= 58) || 
          (now.getHours() === 0 && minutes <= 2)) {
        updateChristmasState();
      }
    }, 10000); // Check every 10 seconds around midnight

    return () => {
      clearInterval(interval);
      clearInterval(midnightCheck);
    };
  }, []);

  const hideCurtains = () => {
    setIsManuallyHidden(true);
  };

  // Check if we're on localhost for override functionality
  const isLocalhost = typeof window !== 'undefined' && 
                     (window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1');

  const shouldShowCurtains = shouldShowChristmasCurtains(christmasState.currentUKTime) && 
                            !isManuallyHidden && 
                            christmasState.isChristmasActive &&
                            !(christmasOverride && isLocalhost); // Hide curtains if override is enabled on localhost

  const contextValue: ChristmasContextType = {
    ...christmasState,
    shouldShowCurtains,
    hideCurtains,
    isManuallyHidden
  };

  return (
    <ChristmasContext.Provider value={contextValue}>
      {children}
    </ChristmasContext.Provider>
  );
};

export const useChristmas = (): ChristmasContextType => {
  const context = useContext(ChristmasContext);
  if (context === undefined) {
    throw new Error('useChristmas must be used within a ChristmasProvider');
  }
  return context;
};

export default ChristmasContext;