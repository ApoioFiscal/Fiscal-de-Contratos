import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type PdfDocumentInput = {
  originalName: string;
  mimeType: string;
  size: number;
  rawText: string;
  structuredData: Record<string, unknown>;
  extractionSummary: string;
};

export const savePdfDocument = async (data: PdfDocumentInput) => {
  const result = await pool.query(
    `INSERT INTO pdf_data (
      original_name,
      mime_type,
      file_size,
      raw_text,
      structured_data,
      extraction_summary
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      original_name,
      mime_type,
      file_size,
      structured_data,
      extraction_summary,
      created_at`,
    [
      data.originalName,
      data.mimeType,
      data.size,
      data.rawText,
      JSON.stringify(data.structuredData),
      data.extractionSummary,
    ],
  );

  return result.rows[0];
};
