import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload,
  Search,
  Trash2,
  ExternalLink,
  Download,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  HardDrive,
  Clock,
  AlertTriangle,
  X,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import { fileService } from '../services/fileService.js'

function formatBytes(bytes) {
  const num = Number(bytes)
  if (!num || num <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(num) / Math.log(k))
  return `${parseFloat((num / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const str = String(dateStr).trim()
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
    if (match) {
      const [_, y, m, d, hh, mm] = match
      const day = String(Number(d)).padStart(2, '0')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const monthName = months[Number(m) - 1] || ''
      const year = y
      const hour24 = hh !== undefined ? Number(hh) : 12
      const minute = mm !== undefined ? String(Number(mm)).padStart(2, '0') : '00'
      const period = hour24 >= 12 ? 'pm' : 'am'
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
      const hourStr = String(hour12).padStart(2, '0')
      return `${day} ${monthName} ${year}, ${hourStr}:${minute} ${period}`
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return String(dateStr)
  }
}

function getFileIconAndCategory(fileName = '', mimeType = '') {
  const lowerName = fileName.toLowerCase()
  const lowerMime = mimeType.toLowerCase()

  if (
    lowerMime.includes('pdf') ||
    lowerName.endsWith('.pdf')
  ) {
    return {
      category: 'PDF',
      label: 'PDF Document',
      icon: FileText,
      colorClass: 'file-icon-pdf',
    }
  }

  if (
    lowerMime.includes('image') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(lowerName)
  ) {
    return {
      category: 'Image',
      label: 'Image File',
      icon: FileImage,
      colorClass: 'file-icon-img',
    }
  }

  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime.includes('excel') ||
    /\.(xlsx?|csv|tsv)$/i.test(lowerName)
  ) {
    return {
      category: 'Spreadsheet',
      label: 'Spreadsheet',
      icon: FileSpreadsheet,
      colorClass: 'file-icon-sheet',
    }
  }

  if (
    lowerMime.includes('word') ||
    lowerMime.includes('document') ||
    /\.(docx?|rtf|txt|odt)$/i.test(lowerName)
  ) {
    return {
      category: 'Document',
      label: 'Word / Text',
      icon: FileText,
      colorClass: 'file-icon-doc',
    }
  }

  if (/\.(zip|rar|7z|tar|gz)$/i.test(lowerName)) {
    return {
      category: 'Archive',
      label: 'Archive / Zip',
      icon: FileCode,
      colorClass: 'file-icon-zip',
    }
  }

  return {
    category: 'Other',
    label: mimeType || 'Generic File',
    icon: File,
    colorClass: 'file-icon-other',
  }
}

export default function FilesPage({ showNotification }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [fileToDelete, setFileToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef(null)

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fileService.getFiles()
      setFiles(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load files:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to load files.' })
      }
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Handle file upload
  const handleUploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const file = fileList[0]

    // 100MB limit check
    if (file.size > 100 * 1024 * 1024) {
      if (showNotification) {
        showNotification({
          type: 'error',
          message: 'File size exceeds maximum allowed limit of 100 MB.',
        })
      }
      return
    }

    try {
      setUploading(true)
      await fileService.uploadFile(file)
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `"${file.name}" uploaded successfully!`,
        })
      }
      await fetchFiles()
    } catch (err) {
      console.error('Upload error:', err)
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to upload file.',
        })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Open / Preview file
  const handleOpenFile = (file) => {
    const viewUrl = fileService.getViewUrl(file.id)
    window.open(viewUrl, '_blank', 'noopener,noreferrer')
  }

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return
    try {
      setDeleting(true)
      await fileService.deleteFile(fileToDelete.id)
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `"${fileToDelete.original_name}" deleted successfully.`,
        })
      }
      setFileToDelete(null)
      await fetchFiles()
    } catch (err) {
      console.error('Delete error:', err)
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to delete file.',
        })
      }
    } finally {
      setDeleting(false)
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files)
    }
  }

  // Filtered files
  const filteredFiles = files.filter((f) => {
    const meta = getFileIconAndCategory(f.original_name, f.file_type)
    const matchesSearch =
      !search.trim() ||
      (f.original_name || '').toLowerCase().includes(search.toLowerCase().trim()) ||
      meta.label.toLowerCase().includes(search.toLowerCase().trim())
    const matchesCategory =
      categoryFilter === 'All' || meta.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Summary stats
  const totalFiles = files.length
  const totalSizeBytes = files.reduce((acc, f) => acc + Number(f.file_size || 0), 0)
  const newestFile = files[0]

  return (
    <div className="files-page-container">
      {/* 1. Header Row */}
      <div className="files-header-row">
        <div className="files-header-info">
          <div className="files-breadcrumb">
            <span style={{ color: '#0293DE' }}>WORKSPACE</span>
            <span style={{ color: '#94A3B8' }}>/</span>
            <span style={{ color: '#64748B' }}>FILES</span>
          </div>
          <h1 className="files-title">Files</h1>
          <p className="files-subtitle">
            Upload, manage, and preview documents, drawings, invoices, and project attachments
          </p>
        </div>

        <div className="files-header-actions">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <button
            type="button"
            className="btn-files-upload-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Upload File</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="files-cards-grid">
        <div className="files-kpi-card">
          <div className="files-card-top">
            <span className="files-card-label">Total Uploaded Files</span>
            <div className="files-card-icon files-card-icon-blue">
              <FolderOpen size={17} />
            </div>
          </div>
          <div className="files-card-val">{totalFiles}</div>
          <div className="files-card-subtext">All stored documents</div>
        </div>

        <div className="files-kpi-card">
          <div className="files-card-top">
            <span className="files-card-label">Storage Consumed</span>
            <div className="files-card-icon files-card-icon-cyan">
              <HardDrive size={17} />
            </div>
          </div>
          <div className="files-card-val">{formatBytes(totalSizeBytes)}</div>
          <div className="files-card-subtext">Dedicated storage</div>
        </div>

        <div className="files-kpi-card">
          <div className="files-card-top">
            <span className="files-card-label">Latest Upload</span>
            <div className="files-card-icon files-card-icon-green">
              <Clock size={17} />
            </div>
          </div>
          <div className="files-card-val files-card-val-date">
            {newestFile ? formatDate(newestFile.uploaded_at) : 'None'}
          </div>
          <div className="files-card-subtext">
            {newestFile ? (newestFile.original_name.length > 28 ? newestFile.original_name.slice(0, 25) + '...' : newestFile.original_name) : 'No files uploaded yet'}
          </div>
        </div>
      </div>

      {/* 3. Drag & Drop Upload Banner */}
      <div
        className={`files-dropzone ${isDragging ? 'files-dropzone--active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="files-dropzone-content">
          <div className="files-dropzone-icon">
            <Upload size={22} />
          </div>
          <div className="files-dropzone-text">
            <span className="files-dropzone-highlight">Click to upload</span> or drag and drop files here
          </div>
          <div className="files-dropzone-hint">
            Supports PDF, Images (PNG, JPG, SVG), Excel, Word, Text, Archives up to 100MB
          </div>
        </div>
      </div>

      {/* 4. Table Card with Filter & Search */}
      <div className="sites-table-card">
        {/* Filter bar */}
        <div className="files-filter-bar">
          <div className="files-search-wrap">
            <Search size={16} className="files-search-icon" />
            <input
              type="text"
              className="files-search-input"
              placeholder="Search files by name or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="files-search-clear"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="files-category-pills">
            {['All', 'PDF', 'Image', 'Spreadsheet', 'Document', 'Other'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`files-category-pill ${categoryFilter === cat ? 'files-category-pill--active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Files Table */}
        <div className="table-responsive-container">
          <table className="expenses-table files-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>File Name</th>
                <th style={{ width: '18%' }}>File Type</th>
                <th style={{ width: '14%' }}>File Size</th>
                <th style={{ width: '16%' }}>Upload Date</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748B' }}>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Loading files...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div className="files-empty-state">
                      <div className="files-empty-icon">
                        <FolderOpen size={36} strokeWidth={1.5} />
                      </div>
                      <div className="files-empty-title">
                        {search || categoryFilter !== 'All' ? 'No matching files found' : 'No files uploaded yet'}
                      </div>
                      <p className="files-empty-desc">
                        {search || categoryFilter !== 'All'
                          ? 'Try clearing the search or category filters.'
                          : 'Upload blueprints, invoices, contracts, or photos from your device to keep them organized.'}
                      </p>
                      {!search && categoryFilter === 'All' && (
                        <button
                          type="button"
                          className="btn-files-upload-primary"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ marginTop: '12px' }}
                        >
                          <Upload size={15} />
                          <span>Upload First File</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const meta = getFileIconAndCategory(file.original_name, file.file_type)
                  const Icon = meta.icon

                  return (
                    <tr key={file.id}>
                      {/* 1. File Name */}
                      <td>
                        <div className="files-name-cell">
                          <div className={`files-type-badge ${meta.colorClass}`}>
                            <Icon size={16} />
                          </div>
                          <div className="files-name-text-wrap">
                            <span
                              className="files-name-title"
                              title={file.original_name}
                              onClick={() => handleOpenFile(file)}
                            >
                              {file.original_name}
                            </span>
                            <span className="files-name-subtitle">
                              Ref: {file.file_name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. File Type */}
                      <td>
                        <span className="files-type-pill">
                          {meta.label}
                        </span>
                      </td>

                      {/* 3. File Size */}
                      <td>
                        <span className="files-size-text">
                          {formatBytes(file.file_size)}
                        </span>
                      </td>

                      {/* 4. Upload Date */}
                      <td>
                        <span className="files-date-text">
                          {formatDate(file.uploaded_at)}
                        </span>
                      </td>

                      {/* 5. Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="files-actions-group">
                          <button
                            type="button"
                            className="files-action-btn files-action-btn--open"
                            onClick={() => handleOpenFile(file)}
                            title="Open or Preview File"
                          >
                            <ExternalLink size={15} />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            className="files-action-btn files-action-btn--delete"
                            onClick={() => setFileToDelete(file)}
                            title="Delete File"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Delete Confirmation Modal Popup */}
      {fileToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setFileToDelete(null)}>
          <div
            className="modal-container"
            style={{ maxWidth: '440px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#172033' }}>
                  Delete File?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5', margin: '0 0 20px' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: '#0F172A' }}>"{fileToDelete.original_name}"</strong>? The stored file
              will be removed from the server.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={deleting}
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
