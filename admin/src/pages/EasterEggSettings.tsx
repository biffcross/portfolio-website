import { useEffect, useState } from 'react';
import { useConfigurationManager } from '../hooks/useConfigurationManager';
import './EasterEggSettings.css';

interface FireworksToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function FireworksToggle({ enabled, onChange, disabled = false }: FireworksToggleProps) {
  return (
    <div className="form-group">
      <label 
        className="easter-egg-label" 
        style={{ 
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        <input 
          type="checkbox" 
          className="easter-egg-checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        Enable Fireworks Mode
      </label>
      <div 
        className="easter-egg-description"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        Allow visitors to trigger fireworks by clicking on the page
      </div>
    </div>
  );
}

interface ChristmasOverrideToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function ChristmasOverrideToggle({ enabled, onChange, disabled = false }: ChristmasOverrideToggleProps) {
  const [presentState, setPresentState] = useState<'bouncing' | 'unwrapping' | 'unwrapped'>('bouncing');

  const handleChange = (checked: boolean) => {
    if (checked && presentState === 'bouncing') {
      setPresentState('unwrapping');
      setTimeout(() => {
        setPresentState('unwrapped');
      }, 1500);
    } else if (!checked) {
      setPresentState('bouncing');
    }
    onChange(checked);
  };

  const getPresentEmoji = () => {
    switch (presentState) {
      case 'bouncing':
        return '🎁';
      case 'unwrapping':
        return '🎁';
      case 'unwrapped':
        return '🎉';
      default:
        return '🎁';
    }
  };

  const getPresentClass = () => {
    switch (presentState) {
      case 'bouncing':
        return 'christmas-present';
      case 'unwrapping':
        return 'christmas-present unwrapping';
      case 'unwrapped':
        return 'christmas-present unwrapped';
      default:
        return 'christmas-present';
    }
  };

  return (
    <div className={`form-group ${!enabled ? 'christmas-override-container' : ''}`}>
      {!enabled && (
        <div className="christmas-message">
          <span className="christmas-emoji">🎄</span>
          Happy Christmas Bro! Check this box to open up your website!
          <span className="christmas-emoji">🎄</span>
        </div>
      )}
      
      <label 
        className="easter-egg-label" 
        style={{ 
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        <input 
          type="checkbox" 
          className="easter-egg-checkbox"
          checked={enabled}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="christmas-present-container">
            <span className={getPresentClass()}>
              {getPresentEmoji()}
            </span>
          </div>
          Christmas Curtains Override
        </div>
      </label>
      <div 
        className="easter-egg-description"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        Hide Christmas curtains globally to reveal the portfolio content
      </div>
    </div>
  );
}

function EasterEggSettings() {
  const { 
    config, 
    isLoading, 
    isSaving, 
    error, 
    loadConfiguration, 
    updateConfig, 
    saveConfiguration 
  } = useConfigurationManager();

  const [localSettings, setLocalSettings] = useState({
    fireworksEnabled: false,
    christmasOverride: false
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Update local settings when config changes
  useEffect(() => {
    if (config?.easterEggs) {
      setLocalSettings({
        fireworksEnabled: config.easterEggs.fireworksEnabled,
        christmasOverride: config.easterEggs.christmasOverride
      });
      setHasUnsavedChanges(false);
    }
  }, [config]);

  const handleFireworksChange = (enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, fireworksEnabled: enabled }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleChristmasOverrideChange = (enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, christmasOverride: enabled }));
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleSaveSettings = async () => {
    if (!config || !hasUnsavedChanges) return;

    setSaveStatus('saving');

    try {
      // Create the updated configuration
      const updatedConfig = {
        ...config,
        easterEggs: {
          fireworksEnabled: localSettings.fireworksEnabled,
          christmasOverride: localSettings.christmasOverride
        }
      };
      
      // Update the local state
      updateConfig({
        easterEggs: {
          fireworksEnabled: localSettings.fireworksEnabled,
          christmasOverride: localSettings.christmasOverride
        }
      });

      // Save the updated config directly to R2
      const success = await saveConfiguration(updatedConfig);
      
      if (success) {
        setSaveStatus('success');
        setHasUnsavedChanges(false);
        
        // Reset success status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Failed to save easter egg settings:', err);
      setSaveStatus('error');
    }
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'success':
        return 'Settings Saved!';
      case 'error':
        return 'Save Failed - Retry';
      default:
        return 'Save Settings';
    }
  };

  const getSaveButtonStyle = () => {
    const baseStyle = {
      opacity: (!hasUnsavedChanges && saveStatus === 'idle') ? 0.6 : 1,
      cursor: (!hasUnsavedChanges && saveStatus === 'idle') ? 'not-allowed' : 'pointer'
    };

    switch (saveStatus) {
      case 'success':
        return { ...baseStyle, backgroundColor: '#28a745', borderColor: '#28a745' };
      case 'error':
        return { ...baseStyle, backgroundColor: '#dc3545', borderColor: '#dc3545' };
      default:
        return baseStyle;
    }
  };

  if (isLoading) {
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          padding: '2rem',
          justifyContent: 'center'
        }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Loading easter egg settings...
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem',
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#721c24'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3 className="section-title">
          Konami Code Feature
        </h3>
        
        <div style={{ 
          background: '#e7f3ff', 
          border: '1px solid #b3d9ff', 
          borderRadius: '6px', 
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ 
            fontSize: '0.95rem', 
            color: '#0056b3', 
            marginBottom: '1rem',
            fontWeight: '500'
          }}>
            🎮 Secret Konami Code Activated!
          </div>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#004085', 
            lineHeight: '1.6',
            marginBottom: '1rem'
          }}>
            Your portfolio includes a hidden Konami code feature! Visitors can activate special effects by entering the classic sequence:
          </div>
          <div style={{ 
            background: '#fff', 
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            padding: '0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            color: '#495057',
            textAlign: 'center',
            marginBottom: '1rem',
            fontWeight: '600'
          }}>
            ↑ ↑ ↓ ↓ ← → ← → B A
          </div>
          <div style={{ 
            fontSize: '0.85rem', 
            color: '#6c757d', 
            fontStyle: 'italic'
          }}>
            <strong>How it works:</strong> When visitors use their keyboard arrow keys followed by the B and A keys in the correct sequence, it will trigger special visual effects on your portfolio. This classic gaming easter egg adds a fun interactive element for tech-savvy visitors to discover!
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3 className="section-title">
          Interactive Features
        </h3>
        
        <div style={{ 
          background: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '6px', 
          padding: '1.5rem'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <FireworksToggle
              enabled={localSettings.fireworksEnabled}
              onChange={handleFireworksChange}
              disabled={isLoading || isSaving}
            />
          </div>
          
          <ChristmasOverrideToggle
            enabled={localSettings.christmasOverride}
            onChange={handleChristmasOverrideChange}
            disabled={isLoading || isSaving}
          />
        </div>
      </div>

      {hasUnsavedChanges && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          marginBottom: '1rem',
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          color: '#856404',
          fontSize: '0.9rem'
        }}>
          You have unsaved changes. Click "Save Settings" to apply them to your portfolio.
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button 
          className="btn"
          onClick={handleSaveSettings}
          disabled={(!hasUnsavedChanges && saveStatus === 'idle') || isSaving}
          style={getSaveButtonStyle()}
        >
          {getSaveButtonText()}
        </button>

        {saveStatus === 'success' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            color: '#28a745',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            Changes applied to portfolio
          </div>
        )}

        {saveStatus === 'error' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            color: '#dc3545',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>✗</span>
            Failed to save changes
          </div>
        )}
      </div>
    </div>
  );
}

export default EasterEggSettings;