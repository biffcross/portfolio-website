import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigurationManager } from '../hooks/useConfigurationManager';
import { useElectronR2Config } from '../hooks/useElectronR2';

function Dashboard() {
  const navigate = useNavigate();
  const { 
    config, 
    isLoading: configLoading, 
    loadConfiguration
    // saveConfiguration 
  } = useConfigurationManager();
  
  const { isValid: r2ConfigValid, error: r2Error, isChecking: r2Checking } = useElectronR2Config();
  
  const [stats, setStats] = useState({
    totalImages: 0,
    totalCategories: 0,
    featuredImages: 0,
    lastUpload: null as Date | null
  });

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Update stats when config changes
  useEffect(() => {
    if (config) {
      const featuredCount = Object.values(config.images).filter(img => img.is_featured).length;
      setStats({
        totalImages: Object.keys(config.images).length,
        totalCategories: config.categories.length,
        featuredImages: featuredCount,
        lastUpload: null // TODO: Track last upload date
      });
    }
  }, [config]);


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
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#495057', marginBottom: '0.5rem' }}>
            {configLoading ? '...' : stats.featuredImages}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Featured Images
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



      {/* Featured Images Information */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '1rem', color: '#495057', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Featured Images
        </h3>
        <div style={{ 
          padding: '1.5rem', 
          background: '#fff', 
          border: '1px solid #dee2e6', 
          borderRadius: '6px'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#495057' }}>
              Featured images are displayed on the home page of your portfolio website. 
              They serve as the first impression for visitors and should showcase your best work.
            </p>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#6c757d' }}>
              Currently, you have <strong>{stats.featuredImages}</strong> image{stats.featuredImages !== 1 ? 's' : ''} marked as featured.
            </p>
          </div>
          
          <div style={{ 
            padding: '1rem', 
            background: '#f8f9fa', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: '#495057' }}>
              Recommendations:
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#6c757d' }}>
              <li>Choose 6-12 of your strongest images for optimal home page display</li>
              <li>Select images that represent the variety and quality of your work</li>
              <li>Consider the visual flow and composition when viewed together</li>
              <li>Update featured images regularly to keep your portfolio fresh</li>
            </ul>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn"
              onClick={() => navigate('/images?filter=featured')}
              style={{ fontSize: '0.9rem' }}
            >
              View Featured Images
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/images')}
              style={{ fontSize: '0.9rem' }}
            >
              Manage All Images
            </button>
          </div>
        </div>
      </div>

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
                <div 
                  key={category.id} 
                  onClick={() => navigate(`/images?filter=${category.id}`)}
                  style={{ 
                    padding: '1rem', 
                    background: '#fff', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#007bff'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.1)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#dee2e6'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
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
                  <div style={{ fontSize: '0.8rem', color: '#6c757d', marginBottom: '0.5rem' }}>
                    {category.description}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#007bff', fontWeight: '500' }}>
                    Click to view images →
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
            onClick={() => navigate('/easter-eggs')}
          >
            Easter Eggs
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard