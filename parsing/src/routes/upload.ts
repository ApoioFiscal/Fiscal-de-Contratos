import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { handleUpload } from '../controllers/uploadController';

const router = Router();

const upload = multer({
  dest: 'uploads/',
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(new Error('Apenas arquivos PDF sao aceitos.'));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const pdfUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'File', maxCount: 1 },
]);

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  pdfUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ erro: 'Upload invalido.', detalhes: error.message });
    }

    if (error instanceof Error) {
      return res.status(400).json({ erro: 'Upload invalido.', detalhes: error.message });
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file = files?.file?.[0] ?? files?.File?.[0];

    if (file) {
      req.file = file;
    }

    return next();
  });
}, handleUpload);

export default router;
