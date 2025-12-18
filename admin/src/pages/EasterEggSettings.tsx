function EasterEggSettings() {
  return (
    <div>
      <h1 className="page-title">Interactive Features</h1>
      
      <h3 className="section-title">Interactive Features</h3>
      
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'none', fontWeight: '400' }}>
          <input type="checkbox" />
          Enable Fireworks Mode
        </label>
        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
          Allow visitors to trigger fireworks by clicking on the page
        </div>
      </div>
      
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'none', fontWeight: '400' }}>
          <input type="checkbox" />
          Christmas Curtains Override (localhost only)
        </label>
        <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem', marginLeft: '1.5rem' }}>
          Hide Christmas curtains on localhost for testing purposes
        </div>
      </div>
      
      <button className="btn">Save Settings</button>
    </div>
  )
}

export default EasterEggSettings