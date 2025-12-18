import { useState, useRef, DragEvent, ChangeEvent } from 'react'
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
  const [isDragOver, setIsDragOver] = useState(false)
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
  const totalProgress = isElectron ? electronR2Upload.totalProgress : browserR2Upload.totalProgress

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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFiles(files)
    }
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
        ? { ...item, status: 'uploading' as const }
        : item
    )
    setUploadProgress(updatedProgress)
    onUploadProgress?.(updatedProgress)

    try {
      if (isElectron && selectedFilePaths.length > 0) {
        // Use Electron R2 upload service
        await electronR2Upload.uploadFiles(
          selectedFilePaths,
          // Key generator: create organized paths
          (filePath, index) => {
            const timestamp = Date.now()
            const fileName = filePath.split(/[\\/]/).pop() || 'unknown'
            const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
            return `images/${timestamp}-${index}-${sanitizedName}`
          }
        )

        // Update progress with results
        const finalProgress = uploadProgress.map((item, index) => {
          if (item.status === 'uploading') {
            const result = electronR2Upload.results.find(r => 
              r.key.includes(item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_'))
            )
            const error = Object.values(electronR2Upload.errors)[index]

            if (error) {
              return {
                ...item,
                status: 'error' as const,
                error: error.message,
                progress: 0
              }
            } else if (result) {
              return {
                ...item,
                status: 'completed' as const,
                progress: 100,
                result
              }
            }
          }
          return item
        })

        setUploadProgress(finalProgress)
        onUploadProgress?.(finalProgress)

        // Call completion callback with successful results
        const successfulResults = finalProgress
          .filter(item => item.result)
          .map(item => item.result!)
        
        if (successfulResults.length > 0) {
          onUploadComplete?.(successfulResults)
        }

      } else {
        // Use browser R2 upload service
        const pendingFiles = uploadProgress
          .filter(item => item.status === 'pending')
          .map(item => item.file)

        if (pendingFiles.length === 0) return

        await browserR2Upload.uploadFiles(
          pendingFiles,
          // Key generator: create organized paths
          (file, index) => {
            const timestamp = Date.now()
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            return `images/${timestamp}-${index}-${sanitizedName}`
          }
        )

        // Update progress with results
        const finalProgress = uploadProgress.map((item, index) => {
          if (item.status === 'uploading') {
            const result = browserR2Upload.results.find(r => 
              r.key.includes(item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_'))
            )
            const error = browserR2Upload.errors[index]

            if (error) {
              return {
                ...item,
                status: 'error' as const,
                error: error.message,
                progress: 0
              }
            } else if (result) {
              return {
                ...item,
                status: 'completed' as const,
                progress: 100,
                result
              }
            }
          }
          return item
        })

        setUploadProgress(finalProgress)
        onUploadProgress?.(finalProgress)

        // Call completion callback with successful results
        const successfulResults = finalProgress
          .filter(item => item.result)
          .map(item => item.result!)
        
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
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={!isElectron ? handleDragOver : undefined}
        onDragLeave={!isElectron ? handleDragLeave : undefined}
        onDrop={!isElectron ? handleDrop : undefined}
        onClick={handleBrowseClick}
      >
        <div className="upload-content">
          <div className="upload-icon">📁</div>
          <h3>
            {isElectron ? 'Click to browse for images' : 'Drop images here or click to browse'}
          </h3>
          <p>Supports: {acceptedTypes.join(', ')}</p>
          <p>Max file size: {(maxFileSize / 1024 / 1024).toFixed(2)}MB</p>
          {isElectron && (
            <p><em>Running in Electron - drag and drop disabled, using native file dialog</em></p>
          )}
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
                    Upload to R2 {isElectron ? '(Electron)' : '(Browser)'}
                  </button>
                </>
              )}
              {isUploading && (
                <div className="upload-status">
                  Uploading... {totalProgress}%
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