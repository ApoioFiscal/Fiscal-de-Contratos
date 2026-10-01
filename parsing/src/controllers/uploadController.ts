import { Request, Response } from 'express';
import { unlink } from 'fs/promises';
import { InvalidPdfError, parsePdfAndPersist } from '../services/pdfService';
import { normalizeUploadFileName } from '../utils/fileName';

export const handleUpload = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo nao enviado. Use o campo multipart "file".' });
  }

  try {
    const result = await parsePdfAndPersist({
      filePath: req.file.path,
      originalName: normalizeUploadFileName(req.file.originalname),
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    return res.status(201).json({ sucesso: true, documento: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    if (error instanceof InvalidPdfError) {
      return res.status(422).json({ erro: 'PDF invalido ou sem texto', detalhes: message });
    }

    return res.status(500).json({ erro: 'Falha ao processar o PDF', detalhes: message });
  } finally {
    await unlink(req.file.path).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Nao foi possivel remover o arquivo temporario: ${message}`);
    });
  }
};
