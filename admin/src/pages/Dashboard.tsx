import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigurationManager } from '../hooks/useConfigurationManager';
import { useElectronR2Config } from '../hooks/useElectronR2';

function Dashboard() {
  const navigate = useNavigate();
  const { 
    config, 
    isLoading: configLoading, 
    loadConfiguration, 
    exportConfigToFile
    // saveConfiguration 
  } = useConfigurationManager();
  
  const { isValid: r2ConfigValid, error: r2Error, isChecking: r2Checking } = useElectronR2Config();
  
  const [stats, setStats] = useState({
    totalImages: 0,
    totalCategories: 0,
    lastUpload: null as Date | null
  });

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Update stats when config changes
  useEffect(() => {
    if (config) {
      setStats({
        totalImages: Object.keys(config.images).length,
        totalCategories: config.categories.length,
        lastUpload: null // TODO: Track last upload date
      });
    }
  }, [config]);

  const handleExportConfig = async () => {
    const success = await exportConfigToFile();
    if (!success) {
      alert('Failed to export configuration. Please check the console for details.');
    }
  };

  // const handleSaveToR2 = async () => {
  //   const success = await saveConfiguration();
  //   if (success) {
  //     alert('Configuration saved to R2 successfully!');
  //   } else {
  //     alert('Failed to save configuration to R2. Please check the console for details.');
  //   }
  // };

  return (
    <div>
      <h1 className="page-title">Portfolio Overview</h1>
      
      {/* System Status */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          padding: '1rem',
          background: r2ConfigValid ? '#f8f9fa' : '#fff3cd',
          border: `1px solid ${r2ConfigValid ? '#dee2e6' : '#ffeaa7'}`,
          borderRadius: '6px'
        }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '50%', 
            background: r2Checking ? '#ffc107' : (r2ConfigValid ? '#28a745' : '#dc3545')
          }}></div>
          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
            {r2Checking ? 'Checking connection...' : 
             r2ConfigValid ? 'System ready' : 
             `Connection error: ${r2Error}`}
          </span>
        </div>
      </div>
      
      {/* Portfolio Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          padding: '1.5rem', 
          background: '#f8f9fa', 
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#495057', marginBottom: '0.5rem' }}>
            {configLoading ? '...' : stats.totalImages}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Images
          </div>
        </div>
        
        <div style={{ 
          padding: '1.5rem', 
          background: '#f8f9fa', 
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#495057', marginBottom: '0.5rem' }}>
            {configLoading ? '...' : stats.totalCategories}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Categories
          </div>
        </div>
        
        <div style={{ 
          padding: '1.5rem', 
          background: '#f8f9fa', 
          borderRadius: '6px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#495057', marginBottom: '0.5rem' }}>
            {config?.site.title || 'Loading...'}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Site Title
          </div>
        </div>
      </div>

      {/* Configuration Details */}
      {config && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '1rem', color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Configuration
          </h3>
          <div style={{ 
            background: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '6px', 
            padding: '1.5rem'
          }}>
            <div className="grid grid-2" style={{ gap: '2rem' }}>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '1rem', color: '#343a40' }}>
                  Site Information
                </h4>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#6c757d' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Title:</strong> {config.site.title}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Description:</strong> {config.site.description}
                  </div>
                  <div>
                    <strong>Instagram:</strong> {config.site.instagram}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '1rem', color: '#343a40' }}>
                  Feature Settings
                </h4>
                <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#6c757d' }}>
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: config.easterEggs.fireworksEnabled ? '#28a745' : '#dc3545'
                    }}></div>
                    <strong>Fireworks:</strong> {config.easterEggs.fireworksEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: config.easterEggs.christmasOverride ? '#ffc107' : '#6c757d'
                    }}></div>
                    <strong>Christmas Override:</strong> {config.easterEggs.christmasOverride ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Overview */}
      {config && config.categories.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '1rem', color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Categories
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gap: '1rem'
          }}>
            {config.categories.map(category => {
              const imageCount = category.images.length
              return (
                <div key={category.id} style={{ 
                  padding: '1rem', 
                  background: '#fff', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '600', margin: 0, color: '#343a40' }}>
                      {category.name}
                    </h4>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      background: '#e9ecef', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '12px',
                      color: '#495057'
                    }}>
                      {imageCount}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    {category.description}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '1rem', color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Actions
        </h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={() => navigate('/images')}
          >
            Manage Images
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/categories')}
          >
            Categories
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/configuration')}
          >
            Settings
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/easter-eggs')}
          >
            Easter Eggs
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleExportConfig}
            disabled={!config || configLoading}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard