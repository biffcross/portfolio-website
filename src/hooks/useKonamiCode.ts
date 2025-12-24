import { useState, useEffect, useCallback } from 'react';

// Konami code sequence: up, up, down, down, left, right, left, right, B, A
const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp', 
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA'
];

const SEQUENCE_TIMEOUT = 10000; // 10 seconds timeout

interface KonamiCodeState {
  isActivated: boolean;
  currentSequence: string[];
  sequenceProgress: number;
}

export const useKonamiCode = () => {
  const [state, setState] = useState<KonamiCodeState>({
    isActivated: false,
    currentSequence: [],
    sequenceProgress: 0
  });

  const resetSequence = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentSequence: [],
      sequenceProgress: 0
    }));
  }, []);

  const activateKonamiCode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActivated: true
    }));
    
    // Reset activation state after a short delay to allow for toggling
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isActivated: false
      }));
    }, 100);
  }, []);

  const deactivateKonamiCode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActivated: false
    }));
    resetSequence();
  }, [resetSequence]);

  useEffect(() => {
    let timeoutId: number | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const keyPressed = event.code;
      const expectedKey = KONAMI_SEQUENCE[state.sequenceProgress];

      setState(prev => {
        // Check if the pressed key matches the expected key in sequence
        if (keyPressed === expectedKey) {
          const newProgress = prev.sequenceProgress + 1;
          const newSequence = [...prev.currentSequence, keyPressed];

          // Check if sequence is complete
          if (newProgress === KONAMI_SEQUENCE.length) {
            // Sequence completed - activate Konami code
            return {
              ...prev,
              isActivated: true,
              currentSequence: [], // Reset for next time
              sequenceProgress: 0 // Reset for next time
            };
          }

          // Continue sequence
          return {
            ...prev,
            currentSequence: newSequence,
            sequenceProgress: newProgress
          };
        } else {
          // Wrong key pressed - reset sequence
          return {
            ...prev,
            currentSequence: [],
            sequenceProgress: 0
          };
        }
      });

      // Set timeout to reset sequence if no input for specified time
      timeoutId = setTimeout(() => {
        resetSequence();
      }, SEQUENCE_TIMEOUT);
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.sequenceProgress, resetSequence]);

  return {
    isKonamiActivated: state.isActivated,
    sequenceProgress: state.sequenceProgress,
    totalSequenceLength: KONAMI_SEQUENCE.length,
    currentSequence: state.currentSequence,
    activateKonamiCode,
    deactivateKonamiCode,
    resetSequence
  };
};

export default useKonamiCode;