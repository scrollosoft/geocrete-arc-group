import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../config/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.resolve(__dirname, '../../uploads/files')

export async function getFiles(_req, res, next) {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM files ORDER BY uploaded_at DESC')
    return res.json(rows)
  } catch (err) {
    next(err)
  }
}

export async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for upload.' })
    }

    const { filename, originalname, mimetype, size } = req.file
    const pool = getPool()

    const [result] = await pool.query(
      `INSERT INTO files (file_name, original_name, file_path, file_type, file_size, uploaded_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [filename, originalname, filename, mimetype || 'application/octet-stream', size || 0],
    )

    const [createdRows] = await pool.query('SELECT * FROM files WHERE id = ?', [result.insertId])
    return res.status(201).json(createdRows[0] || { id: result.insertId, file_name: filename })
  } catch (err) {
    next(err)
  }
}

export async function viewFile(req, res, next) {
  try {
    const { id } = req.params
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [id])

    if (!rows.length) {
      return res.status(404).json({ error: 'File record not found.' })
    }

    const file = rows[0]
    const absolutePath = path.resolve(uploadsDir, file.file_name)

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Physical file not found on server.' })
    }

    // Set headers so PDFs/images/texts open in browser inline
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`)
    return res.sendFile(absolutePath)
  } catch (err) {
    next(err)
  }
}

export async function downloadFile(req, res, next) {
  try {
    const { id } = req.params
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [id])

    if (!rows.length) {
      return res.status(404).json({ error: 'File record not found.' })
    }

    const file = rows[0]
    const absolutePath = path.resolve(uploadsDir, file.file_name)

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'Physical file not found on server.' })
    }

    return res.download(absolutePath, file.original_name)
  } catch (err) {
    next(err)
  }
}

export async function deleteFile(req, res, next) {
  try {
    const { id } = req.params
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM files WHERE id = ?', [id])

    if (!rows.length) {
      return res.status(404).json({ error: 'File record not found.' })
    }

    const file = rows[0]
    const absolutePath = path.resolve(uploadsDir, file.file_name)

    // Remove from database
    await pool.query('DELETE FROM files WHERE id = ?', [id])

    // Safely remove physical file if it exists
    try {
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath)
      }
    } catch (fsErr) {
      console.warn('Could not delete physical file from disk:', fsErr.message)
    }

    return res.json({ success: true, message: 'File deleted successfully.' })
  } catch (err) {
    next(err)
  }
}
