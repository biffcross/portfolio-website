import { useState, useRef, useEffect } from 'react'
import './CategoryTags.css'

interface CategoryTagsProps {
  categories: string[]
  availableCategories: Array<{ id: string; name: string }>
  onCategoriesChange: (newCategories: string[]) => void
  disabled?: boolean
}

function CategoryTags({ categories, availableCategories, onCategoriesChange, disabled = false }: CategoryTagsProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState<'up' | 'down'>('up')
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleRemoveCategory = (categoryToRemove: string) => {
    if (disabled) return
    const newCategories = categories.filter(cat => cat !== categoryToRemove)
    onCategoriesChange(newCategories)
  }

  const handleAddCategory = (categoryToAdd: string) => {
    if (disabled || categories.includes(categoryToAdd)) return
    const newCategories = [...categories, categoryToAdd]
    onCategoriesChange(newCategories)
    setShowAddMenu(false)
  }

  const handleToggleMenu = () => {
    if (!showAddMenu && buttonRef.current) {
      // Calculate if there's enough space above for the menu
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const menuHeight = 200 // max-height of menu
      const spaceAbove = buttonRect.top
      const spaceBelow = window.innerHeight - buttonRect.bottom
      
      // Prefer upward positioning, but use downward if not enough space above
      setMenuPosition(spaceAbove >= menuHeight || spaceAbove > spaceBelow ? 'up' : 'down')
    }
    setShowAddMenu(!showAddMenu)
  }

  const getCategoryName = (categoryId: string) => {
    if (categoryId === 'uncategorized') return 'Uncategorized'
    const category = availableCategories.find(cat => cat.id === categoryId)
    return category?.name || categoryId
  }

  const getAvailableCategories = () => {
    return availableCategories.filter(cat => !categories.includes(cat.id))
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowAddMenu(false)
      }
    }

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddMenu])

  return (
    <div className="category-tags">
      <div className="category-tags-container">
        {categories.length === 0 ? (
          <span className="category-tag uncategorized">
            Uncategorized
          </span>
        ) : (
          categories.map(categoryId => (
            <span key={categoryId} className="category-tag">
              {getCategoryName(categoryId)}
              {!disabled && (
                <button
                  className="category-tag-remove"
                  onClick={() => handleRemoveCategory(categoryId)}
                  title={`Remove from ${getCategoryName(categoryId)}`}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
        
        {!disabled && (
          <div className="category-add-container">
            <button
              ref={buttonRef}
              className="category-add-button"
              onClick={handleToggleMenu}
              title="Add to category"
            >
              +
            </button>
            
            {showAddMenu && (
              <div 
                ref={menuRef}
                className={`category-add-menu ${menuPosition === 'down' ? 'menu-down' : 'menu-up'}`}
              >
                {getAvailableCategories().length > 0 ? (
                  getAvailableCategories().map(category => (
                    <button
                      key={category.id}
                      className="category-add-option"
                      onClick={() => handleAddCategory(category.id)}
                    >
                      {category.name}
                    </button>
                  ))
                ) : (
                  <div className="category-add-empty">
                    All categories assigned
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryTags