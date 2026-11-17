import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleUpload } from '../controllers/uploadController';

const router = Router();

const upload = multer({
  // Na Vercel o diretório do projeto é read-only; o único local gravável é /tmp.
  dest: join(tmpdir(), 'apoiofiscal-parsing'),
  fileFilter: (_req, file, callback) => {
    // Alguns clientes mandam PDF como application/octet-stream (ou sem tipo). A assinatura
    // "%PDF-" é validada de verdade em pdfService, então aqui só barramos tipos claramente errados.
    const mime = (file.mimetype || '').toLowerCase();
    const isPdfName = /\.pdf$/i.test(file.originalname || '');
    const aceito = mime === 'application/pdf' || mime === 'application/x-pdf' ||
      ((mime === 'application/octet-stream' || mime === '') && isPdfName);

    if (!aceito) {
      callback(new Error('Apenas arquivos PDF sao aceitos.'));
      return;
    }

    callback(null, true);
  },
  limits: {
    // Mesmo teto do backend (express.raw 20mb); PDFs escaneados costumam passar de 15MB.
    fileSize: 20 * 1024 * 1024,
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
