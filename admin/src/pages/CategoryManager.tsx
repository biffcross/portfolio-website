import { useEffect, useState, useMemo } from 'react';
import { useConfigurationManager } from '../hooks/useConfigurationManager';
import CategoryDialog, { CategoryFormData } from '../components/CategoryDialog';
import ConfirmationDialog from '../components/ConfirmationDialog';

interface CategoryDialogState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  categoryData?: Partial<CategoryFormData>;
}

interface DeleteDialogState {
  isOpen: boolean;
  categoryId: string;
  categoryName: string;
  imageCount: number;
}

function CategoryManager() {
  const { 
    config, 
    isLoading, 
    error, 
    loadConfiguration,
    updateConfig,
    saveConfiguration
  } = useConfigurationManager();

  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({
    isOpen: false,
    mode: 'create'
  });

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    isOpen: false,
    categoryId: '',
    categoryName: '',
    imageCount: 0
  });

  const [operationError, setOperationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Memoize existing category IDs to prevent unnecessary re-renders
  const existingCategoryIds = useMemo(() => {
    return config?.categories.map(cat => cat.id) || [];
  }, [config?.categories]);

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const handleAddCategory = () => {
    setCategoryDialog({
      isOpen: true,
      mode: 'create'
    });
    setOperationError(null);
  };

  const handleEditCategory = (categoryId: string) => {
    const category = config?.categories.find(cat => cat.id === categoryId);
    if (!category) return;

    setCategoryDialog({
      isOpen: true,
      mode: 'edit',
      categoryData: {
        id: category.id,
        name: category.name,
        description: category.description
      }
    });
    setOperationError(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const category = config?.categories.find(cat => cat.id === categoryId);
    if (!category) return;

    setDeleteDialog({
      isOpen: true,
      categoryId: category.id,
      categoryName: category.name,
      imageCount: category.images.length
    });
    setOperationError(null);
  };

  const handleCategorySubmit = async (categoryData: CategoryFormData): Promise<boolean> => {
    if (!config) return false;

    setIsProcessing(true);
    setOperationError(null);

    try {
      let updatedConfig;

      if (categoryDialog.mode === 'create') {
        // Check if category ID already exists
        const existingCategory = config.categories.find(cat => cat.id === categoryData.id);
        if (existingCategory) {
          setOperationError(`Category with ID "${categoryData.id}" already exists`);
          return false;
        }

        // Add new category
        updatedConfig = {
          ...config,
          categories: [
            ...config.categories,
            {
              id: categoryData.id,
              name: categoryData.name,
              description: categoryData.description,
              images: []
            }
          ]
        };
        
      } else {
        // Update existing category
        const categoryIndex = config.categories.findIndex(cat => cat.id === categoryData.id);
        if (categoryIndex === -1) {
          setOperationError('Category not found');
          return false;
        }

        const updatedCategories = [...config.categories];
        updatedCategories[categoryIndex] = {
          ...updatedCategories[categoryIndex],
          name: categoryData.name,
          description: categoryData.description
        };

        updatedConfig = {
          ...config,
          categories: updatedCategories
        };
      }

      // Update local state
      updateConfig(updatedConfig);
      
      // Save to R2
      const saveSuccess = await saveConfiguration(updatedConfig);
      if (!saveSuccess) {
        setOperationError('Failed to save configuration to R2');
        return false;
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save category';
      setOperationError(errorMessage);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!config) return;

    setIsProcessing(true);
    setOperationError(null);

    try {
      const categoryToDelete = config.categories.find(cat => cat.id === deleteDialog.categoryId);
      if (!categoryToDelete) {
        setOperationError('Category not found');
        return;
      }

      // Handle images assigned to this category
      let updatedImages = { ...config.images };
      let updatedCategories = [...config.categories];

      if (categoryToDelete.images.length > 0) {
        // Ensure "uncategorized" category exists
        let uncategorizedCategory = updatedCategories.find(cat => cat.id === 'uncategorized');
        if (!uncategorizedCategory) {
          uncategorizedCategory = {
            id: 'uncategorized',
            name: 'Uncategorized',
            description: 'Images without a specific category',
            images: []
          };
          updatedCategories.push(uncategorizedCategory);
        }

        // Move images to uncategorized
        categoryToDelete.images.forEach(imageId => {
          const image = updatedImages[imageId];
          if (image) {
            // Update image categories (remove deleted category, add uncategorized if not present)
            const currentCategories = image.categories || (image.category ? [image.category] : []);
            const filteredCategories = currentCategories.filter(cat => cat !== deleteDialog.categoryId);
            
            if (!filteredCategories.includes('uncategorized')) {
              filteredCategories.push('uncategorized');
            }

            // Update image metadata
            updatedImages[imageId] = {
              ...image,
              categories: filteredCategories
            };

            // Add to uncategorized category if not already there
            const uncategorizedIndex = updatedCategories.findIndex(cat => cat.id === 'uncategorized');
            if (uncategorizedIndex !== -1 && !updatedCategories[uncategorizedIndex].images.includes(imageId)) {
              updatedCategories[uncategorizedIndex].images.push(imageId);
            }
          }
        });
      }

      // Remove the category
      updatedCategories = updatedCategories.filter(cat => cat.id !== deleteDialog.categoryId);

      const updatedConfig = {
        ...config,
        categories: updatedCategories,
        images: updatedImages
      };

      // Update local state
      updateConfig(updatedConfig);
      
      // Save to R2
      const saveSuccess = await saveConfiguration(updatedConfig);
      if (!saveSuccess) {
        setOperationError('Failed to save configuration to R2');
        throw new Error('Failed to save configuration to R2');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
      setOperationError(errorMessage);
      throw error; // Re-throw to prevent dialog from closing
    } finally {
      setIsProcessing(false);
    }
  };

  const closeCategoryDialog = () => {
    setCategoryDialog({ isOpen: false, mode: 'create' });
    setOperationError(null);
  };

  const closeDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      categoryId: '',
      categoryName: '',
      imageCount: 0
    });
    setOperationError(null);
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
          Loading categories...
        </div>
      </div>
    );
  }

  return (
    <div>
      {(error || operationError) && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem',
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#721c24'
        }}>
          <strong>Error:</strong> {error || operationError}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 className="section-title">All Categories</h3>
        <button 
          className="btn"
          onClick={handleAddCategory}
          disabled={isProcessing}
        >
          Add New Category
        </button>
      </div>
      
      {config && config.categories.length > 0 ? (
        <div style={{ 
          display: 'grid', 
          gap: '1rem'
        }}>
          {config.categories.map(category => {
            const imageCount = category.images.length;
            return (
              <div key={category.id} style={{ 
                border: '1px solid #dee2e6', 
                borderRadius: '6px',
                padding: '1.5rem',
                background: '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '600', 
                      margin: '0 0 0.5rem 0', 
                      color: '#343a40' 
                    }}>
                      {category.name}
                    </h4>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#6c757d', 
                      margin: '0 0 0.75rem 0',
                      lineHeight: '1.5'
                    }}>
                      {category.description}
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '1rem',
                      fontSize: '0.85rem',
                      color: '#6c757d'
                    }}>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem'
                      }}>
                        <strong>Images:</strong> {imageCount}
                      </span>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.25rem'
                      }}>
                        <strong>ID:</strong> {category.id}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button 
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                      onClick={() => handleEditCategory(category.id)}
                      disabled={isProcessing}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn btn-secondary"
                      style={{ 
                        fontSize: '0.85rem', 
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#dc3545',
                        borderColor: '#dc3545',
                        color: '#fff'
                      }}
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={isProcessing}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {imageCount > 0 && (
                  <div style={{ 
                    borderTop: '1px solid #e9ecef',
                    paddingTop: '1rem',
                    marginTop: '1rem'
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: '500', 
                      marginBottom: '0.5rem',
                      color: '#495057'
                    }}>
                      Recent Images:
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '0.5rem', 
                      flexWrap: 'wrap'
                    }}>
                      {category.images.slice(0, 5).map(imageId => {
                        const image = config.images[imageId];
                        return image ? (
                          <div key={imageId} style={{ 
                            fontSize: '0.8rem',
                            background: '#e9ecef',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            color: '#495057'
                          }}>
                            {image.caption || imageId}
                          </div>
                        ) : null;
                      })}
                      {imageCount > 5 && (
                        <div style={{ 
                          fontSize: '0.8rem',
                          background: '#6c757d',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          color: '#fff'
                        }}>
                          +{imageCount - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ 
          border: '1px solid #e0e0e0', 
          padding: '2rem',
          textAlign: 'center',
          color: '#666',
          borderRadius: '6px',
          background: '#f8f9fa'
        }}>
          No categories created yet
        </div>
      )}

      <CategoryDialog
        isOpen={categoryDialog.isOpen}
        onClose={closeCategoryDialog}
        onSubmit={handleCategorySubmit}
        title={categoryDialog.mode === 'create' ? 'Add New Category' : 'Edit Category'}
        submitText={categoryDialog.mode === 'create' ? 'Create Category' : 'Update Category'}
        initialData={categoryDialog.categoryData}
        existingCategoryIds={existingCategoryIds}
        isIdEditable={categoryDialog.mode === 'create'}
      />

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={
          deleteDialog.imageCount > 0
            ? `Are you sure you want to delete the category "${deleteDialog.categoryName}"? This category contains ${deleteDialog.imageCount} image${deleteDialog.imageCount === 1 ? '' : 's'}. The images will be moved to the "Uncategorized" category.`
            : `Are you sure you want to delete the category "${deleteDialog.categoryName}"? This action cannot be undone.`
        }
        confirmText="Delete Category"
        cancelText="Cancel"
        variant="danger"
        isProcessing={isProcessing}
      />
    </div>
  )
}

export default CategoryManager