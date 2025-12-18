function CategoryManager() {
  return (
    <div>
      <h1 className="page-title">Category Management</h1>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 className="section-title">All Categories</h3>
        <button className="btn">Add New Category</button>
      </div>
      
      <div style={{ 
        border: '1px solid #e0e0e0', 
        padding: '2rem',
        textAlign: 'center',
        color: '#666'
      }}>
        No categories created yet
      </div>
    </div>
  )
}

export default CategoryManager