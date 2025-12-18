import { useState, useRef, ChangeEvent } from 'react'

interface MultiFileUploadProps {
  onFilesSelected: (files: File[]) => void
  acceptedTypes?: string[]
  maxFiles?: number
  disabled?: boolean
}

function MultiFileUpload({ 
  onFilesSelected, 
  acceptedTypes = ['image/*'],
  maxFiles = 10,
  disabled = false
}: MultiFileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length > maxFiles) {
      alert(`You can only select up to ${maxFiles} files at once.`)
      return
    }

    setSelectedFiles(files)
    onFilesSelected(files)
  }

  const handleBrowseClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const clearSelection = () => {
    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onFilesSelected([])
  }

  return (
    <div className="multi-file-upload">
      <div className="upload-controls">
        <button 
          type="button"
          className="btn"
          onClick={handleBrowseClick}
          disabled={disabled}
        >
          Select Files
        </button>
        {selectedFiles.length > 0 && (
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={clearSelection}
            disabled={disabled}
          >
            Clear ({selectedFiles.length})
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <h4>Selected Files ({selectedFiles.length})</h4>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={index}>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default MultiFileUpload