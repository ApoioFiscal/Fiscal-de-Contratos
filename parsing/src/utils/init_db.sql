CREATE TABLE IF NOT EXISTS pdf_data (
  id SERIAL PRIMARY KEY,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  structured_data JSONB NOT NULL,
  extraction_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS structured_data JSONB;
ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE pdf_data
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pdf_data'
      AND column_name = 'ai_summary'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pdf_data'
      AND column_name = 'extraction_summary'
  ) THEN
    ALTER TABLE pdf_data RENAME COLUMN ai_summary TO extraction_summary;
  END IF;
END $$;

ALTER TABLE pdf_data ADD COLUMN IF NOT EXISTS extraction_summary TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pdf_data'
      AND column_name = 'content'
  ) THEN
    UPDATE pdf_data
    SET
      original_name = COALESCE(original_name, 'documento-legado.pdf'),
      mime_type = COALESCE(mime_type, 'application/pdf'),
      file_size = COALESCE(file_size, 0),
      raw_text = COALESCE(raw_text, content),
      structured_data = COALESCE(structured_data, '{}'::jsonb)
    WHERE raw_text IS NULL OR structured_data IS NULL;
  ELSE
    UPDATE pdf_data
    SET
      original_name = COALESCE(original_name, 'documento.pdf'),
      mime_type = COALESCE(mime_type, 'application/pdf'),
      file_size = COALESCE(file_size, 0),
      raw_text = COALESCE(raw_text, ''),
      structured_data = COALESCE(structured_data, '{}'::jsonb)
    WHERE raw_text IS NULL OR structured_data IS NULL;
  END IF;
END $$;
