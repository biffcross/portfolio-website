import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useR2Upload } from '../hooks/useR2Upload'
import { useElectronR2 } from '../hooks/useElectronR2'
import { useElectronFS, useElectronStatus } from '../hooks/useElectronAPI'
import type { UploadResult } from '../services/r2Service'
import './FileUploader.css'

interface FileUploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  result?: UploadResult
}

interface FileUploaderProps {
  onFilesSelected?: (files: File[]) => void
  onUploadProgress?: (progress: FileUploadProgress[]) => void
  onUploadComplete?: (results: UploadResult[]) => void
  acceptedTypes?: string[]
  maxFileSize?: number // in bytes
}

function FileUploader({ 
  onFilesSelected, 
  onUploadProgress,
  onUploadComplete,
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxFileSize = 100 * 1024 * 1024 // 100MB default for high-resolution photography
}: FileUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([])
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Check if we're running in Electron
  const { isElectron } = useElectronStatus()
  const electronFS = useElectronFS()
  
  // Use appropriate upload service based on environment
  const browserR2Upload = useR2Upload()
  const electronR2Upload = useElectronR2()
  
  const isUploading = isElectron ? electronR2Upload.isUploading : browserR2Upload.isUploading

  // Auto-open file dialog when component mounts
  useEffect(() => {
    // Small delay to ensure component is fully rendered
    const timer = setTimeout(() => {
      handleBrowseClick()
    }, 100)
    
    return () => clearTimeout(timer)
  }, []) // Empty dependency array means this runs once on mount

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported. Please use: ${acceptedTypes.join(', ')}`
    }
    if (file.size > maxFileSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum size of ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`
    }
    return null
  }

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const newProgress: FileUploadProgress[] = []

    fileArray.forEach(file => {
      const error = validateFile(file)
      if (error) {
        newProgress.push({
          file,
          progress: 0,
          status: 'error',
          error
        })
      } else {
        validFiles.push(file)
        newProgress.push({
          file,
          progress: 0,
          status: 'pending'
        })
      }
    })

    setUploadProgress(newProgress)
    onUploadProgress?.(newProgress)
    
    if (validFiles.length > 0) {
      onFilesSelected?.(validFiles)
    }
  }

  const processElectronFiles = async (filePaths: string[]) => {
    if (!electronFS.isReady || !electronFS.readFile) return

    const newProgress: FileUploadProgress[] = []
    const validFilePaths: string[] = []

    for (const filePath of filePaths) {
      try {
        // Read file to get size and create a File-like object for validation
        const result = await electronFS.readFile(filePath)
        if (result.success && result.data) {
          const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
          const extension = fileName.split('.').pop()?.toLowerCase()
          
          // Determine MIME type
          let mimeType = 'application/octet-stream'
          if (extension) {
            const mimeTypes: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
            }
            mimeType = mimeTypes[extension] || mimeType
          }

          // Create a File-like object for validation
          const fileForValidation = new File([new Uint8Array(result.data)], fileName, { type: mimeType })
          const error = validateFile(fileForValidation)
          
          if (error) {
            newProgress.push({
              file: fileForValidation,
              progress: 0,
              status: 'error',
              error
            })
          } else {
            validFilePaths.push(filePath)
            newProgress.push({
              file: fileForValidation,
              progress: 0,
              status: 'pending'
            })
          }
        } else {
          const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
          const dummyFile = new File([], fileName)
          newProgress.push({
            file: dummyFile,
            progress: 0,
            status: 'error',
            error: result.error || 'Failed to read file'
          })
        }
      } catch (error) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
        const dummyFile = new File([], fileName)
        newProgress.push({
          file: dummyFile,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to process file'
        })
      }
    }

    setUploadProgress(newProgress)
    setSelectedFilePaths(validFilePaths)
    onUploadProgress?.(newProgress)
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFiles(files)
    }
  }

  const handleBrowseClick = async () => {
    if (isElectron && electronFS.isReady && electronFS.selectFiles) {
      // Use Electron file dialog
      try {
        const filePaths = await electronFS.selectFiles({
          multiple: true,
          filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })
        
        if (filePaths.length > 0) {
          await processElectronFiles(filePaths)
        }
      } catch (error) {
        console.error('Failed to select files:', error)
      }
    } else {
      // Use browser file input
      fileInputRef.current?.click()
    }
  }

  const startUpload = async () => {
    if (uploadProgress.length === 0) return

    // Update all pending files to uploading status
    const updatedProgress = uploadProgress.map(item => 
      item.status === 'pending' 
        ? { ...item, status: 'uploading' as const, progress: 0 }
        : item
    )
    setUploadProgress(updatedProgress)
    onUploadProgress?.(updatedProgress)

    try {
      if (isElectron && selectedFilePaths.length > 0) {
        // Use Electron R2 upload service
        const uploadResults = await electronR2Upload.uploadFiles(
          selectedFilePaths,
          // Key generator: create organized paths
          (filePath) => {
            const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
            const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
            return `images/${sanitizedName}`
          }
        )

        // Update progress with results - use the results returned directly from the upload function
        const finalProgress = [...updatedProgress]
        
        // Get indices of files that were uploading
        const uploadingIndices = finalProgress
          .map((item, index) => item.status === 'uploading' ? index : -1)
          .filter(index => index !== -1)
        
        // Use results returned directly from the upload function
        const results = uploadResults || []
        const errors = electronR2Upload.errors
        
        // Mark successful uploads - results are in the same order as uploaded files
        results.forEach((result, resultIndex) => {
          const progressIndex = uploadingIndices[resultIndex]
          
          if (progressIndex !== undefined && progressIndex !== -1) {
            finalProgress[progressIndex] = {
              ...finalProgress[progressIndex],
              status: 'completed' as const,
              progress: 100,
              result
            }
          }
        })

        // Mark failed uploads
        Object.entries(errors).forEach(([indexStr, error]) => {
          const resultIndex = parseInt(indexStr)
          const progressIndex = uploadingIndices[resultIndex]
          
          if (progressIndex !== undefined && progressIndex !== -1) {
            finalProgress[progressIndex] = {
              ...finalProgress[progressIndex],
              status: 'error' as const,
              error: error.message,
              progress: 0
            }
          }
        })

        setUploadProgress(finalProgress)
        onUploadProgress?.(finalProgress)

        // Call completion callback with successful results
        if (results.length > 0) {
          onUploadComplete?.(results)
        }

      } else {
        // Use browser R2 upload service with proper progress tracking
        const pendingFiles = uploadProgress
          .filter(item => item.status === 'pending')
          .map(item => item.file)

        if (pendingFiles.length === 0) return

        // Reset the browser upload service
        browserR2Upload.reset()

        // Start the upload with progress callbacks
        await browserR2Upload.uploadFiles(
          pendingFiles,
          // Key generator: create organized paths
          (file) => {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            return `images/${sanitizedName}`
          }
        )

        // Update progress with results from the upload service
        const finalProgress = [...updatedProgress]
        
        // Mark successful uploads
        browserR2Upload.results.forEach((result) => {
          // Find the corresponding file in our progress array
          const progressIndex = uploadProgress.findIndex(item => 
            item.status === 'pending' && 
            item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_') === result.key.split('/').pop()
          )
          
          if (progressIndex !== -1) {
            finalProgress[progressIndex] = {
              ...finalProgress[progressIndex],
              status: 'completed' as const,
              progress: 100,
              result
            }
          }
        })

        // Mark failed uploads
        Object.entries(browserR2Upload.errors).forEach(([indexStr, error]) => {
          const fileIndex = parseInt(indexStr)
          // Find the corresponding file in our progress array
          const progressIndex = uploadProgress.findIndex((item, idx) => 
            item.status === 'pending' && idx === fileIndex
          )
          
          if (progressIndex !== -1) {
            finalProgress[progressIndex] = {
              ...finalProgress[progressIndex],
              status: 'error' as const,
              error: error.message,
              progress: 0
            }
          }
        })

        setUploadProgress(finalProgress)
        onUploadProgress?.(finalProgress)

        // Call completion callback with successful results
        const successfulResults = browserR2Upload.results
        if (successfulResults.length > 0) {
          onUploadComplete?.(successfulResults)
        }
      }

    } catch (error) {
      // Handle general upload failure
      const errorProgress = uploadProgress.map(item => 
        item.status === 'uploading'
          ? {
              ...item,
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Upload failed',
              progress: 0
            }
          : item
      )
      setUploadProgress(errorProgress)
      onUploadProgress?.(errorProgress)
    }
  }

  const clearFiles = () => {
    setUploadProgress([])
    setSelectedFilePaths([])
    if (isElectron) {
      electronR2Upload.reset()
    } else {
      browserR2Upload.reset()
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="file-uploader">
      <div 
        className="upload-zone"
        onClick={handleBrowseClick}
      >
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h3>Click here to browse files</h3>
          <p>Supports: {acceptedTypes.join(', ')}</p>
          <p>Max file size: {(maxFileSize / 1024 / 1024).toFixed(2)}MB</p>
        </div>
        {!isElectron && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        )}
      </div>

      {uploadProgress.length > 0 && (
        <div className="upload-progress-section">
          <div className="progress-header">
            <h4>Selected Files ({uploadProgress.length})</h4>
            <div className="progress-actions">
              {!isUploading && (
                <>
                  <button className="btn btn-secondary" onClick={clearFiles}>
                    Clear All
                  </button>
                  <button 
                    className="btn" 
                    onClick={startUpload}
                    disabled={uploadProgress.filter(item => item.status === 'pending').length === 0}
                  >
                    Upload
                  </button>
                </>
              )}
              {isUploading && (
                <div className="upload-status">
                  Uploading...
                </div>
              )}
            </div>
          </div>
          
          <div className="file-list">
            {uploadProgress.map((item, index) => (
              <div key={index} className={`file-item ${item.status}`}>
                <div className="file-info">
                  <div className="file-name">{item.file.name}</div>
                  <div className="file-size">
                    {(item.file.size / 1024 / 1024).toFixed(2)}MB
                  </div>
                </div>
                
                <div className="file-status">
                  {item.status === 'error' ? (
                    <div className="status-indicator error">
                      <span className="status-icon">✗</span>
                      <div className="error-message">{item.error}</div>
                    </div>
                  ) : item.status === 'completed' ? (
                    <div className="status-indicator success">
                      <span className="status-icon">✓</span>
                      <span className="status-text">Upload Complete</span>
                    </div>
                  ) : item.status === 'uploading' ? (
                    <div className="status-indicator uploading">
                      <span className="status-icon">⟳</span>
                      <span className="status-text">Uploading...</span>
                    </div>
                  ) : (
                    <div className="status-indicator pending">
                      <span className="status-icon">○</span>
                      <span className="status-text">Ready to Upload</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FileUploader