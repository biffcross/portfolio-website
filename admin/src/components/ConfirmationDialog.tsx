import React from 'react';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isProcessing?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isProcessing = false
}) => {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error in confirmation action:', error);
      // Don't close dialog on error - let parent handle error display
    }
  };

  if (!isOpen) return null;

  return (
    <div className="confirmation-dialog-overlay" onClick={onClose}>
      <div className="confirmation-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirmation-dialog-header">
          <h3 className={`confirmation-dialog-title ${variant}`}>{title}</h3>
          <button 
            className="confirmation-dialog-close"
            onClick={onClose}
            type="button"
            disabled={isProcessing}
          >
            ×
          </button>
        </div>

        <div className="confirmation-dialog-body">
          <p className="confirmation-dialog-message">{message}</p>
        </div>

        <div className="confirmation-dialog-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isProcessing}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`btn btn-${variant}`}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;