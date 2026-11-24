import express from 'express'
import { upload } from '../middleware/upload.js'
import {
  getFiles,
  uploadFile,
  viewFile,
  downloadFile,
  deleteFile,
} from '../controllers/fileController.js'

const router = express.Router()

router.get('/', getFiles)
router.post('/upload', upload.single('file'), uploadFile)
router.get('/:id/view', viewFile)
router.get('/:id/download', downloadFile)
router.delete('/:id', deleteFile)

export default router
