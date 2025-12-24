import React, { useState, useEffect } from 'react';
import './CategoryDialog.css';

export interface CategoryFormData {
  id: string;
  name: string;
  description: string;
}

interface CategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (categoryData: CategoryFormData) => Promise<boolean>;
  title: string;
  submitText: string;
  initialData?: Partial<CategoryFormData>;
  existingCategoryIds?: string[];
  isIdEditable?: boolean;
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  submitText,
  initialData = {},
  existingCategoryIds = [],
  isIdEditable = true
}) => {
  const [formData, setFormData] = useState<CategoryFormData>({
    id: '',
    name: '',
    description: '',
    ...initialData
  });
  const [errors, setErrors] = useState<Partial<CategoryFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        id: initialData?.id || '',
        name: initialData?.name || '',
        description: initialData?.description || ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // Auto-generate ID from name when creating new category
  const generateIdFromName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CategoryFormData> = {};

    // Validate ID
    if (!formData.id.trim()) {
      newErrors.id = 'Category ID is required';
    } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
      newErrors.id = 'Category ID can only contain lowercase letters, numbers, and hyphens';
    } else if (existingCategoryIds.includes(formData.id) && formData.id !== initialData.id) {
      newErrors.id = 'Category ID already exists';
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Category description is required';
    } else if (formData.description.trim().length < 5) {
      newErrors.description = 'Category description must be at least 5 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const success = await onSubmit({
        id: formData.id.trim(),
        name: formData.name.trim(),
        description: formData.description.trim()
      });

      if (success) {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CategoryFormData, value: string) => {
    if (field === 'name' && isIdEditable && !initialData.id) {
      // Auto-generate ID when name changes for new categories
      const generatedId = generateIdFromName(value);
      setFormData(prev => ({ ...prev, [field]: value, id: generatedId }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="category-dialog-overlay" onClick={onClose}>
      <div className="category-dialog" onClick={e => e.stopPropagation()}>
        <div className="category-dialog-header">
          <h2>{title}</h2>
          <button 
            className="category-dialog-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="category-dialog-form">
          <div className="form-group">
            <label htmlFor="category-name">Category Name *</label>
            <input
              id="category-name"
              type="text"
              value={formData.name}
              onChange={e => handleInputChange('name', e.target.value)}
              placeholder="Enter category name"
              className={errors.name ? 'error' : ''}
              disabled={isSubmitting}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="category-id">Category ID *</label>
            <input
              id="category-id"
              type="text"
              value={formData.id}
              onChange={e => handleInputChange('id', e.target.value)}
              placeholder="category-id"
              className={errors.id ? 'error' : ''}
              disabled={isSubmitting || !isIdEditable}
              readOnly={!isIdEditable}
            />
            {errors.id && <span className="error-message">{errors.id}</span>}
            {isIdEditable && (
              <small className="form-help">
                Used in URLs. Only lowercase letters, numbers, and hyphens allowed.
              </small>
            )}
            {!isIdEditable && (
              <small className="form-help">
                Category ID cannot be changed to maintain data integrity.
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="category-description">Description *</label>
            <textarea
              id="category-description"
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              placeholder="Enter category description"
              className={errors.description ? 'error' : ''}
              disabled={isSubmitting}
              rows={3}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
          </div>

          <div className="category-dialog-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryDialog;