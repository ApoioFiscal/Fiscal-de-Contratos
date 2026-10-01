import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';

dotenv.config();

const initDb = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL nao configurada. Crie um arquivo .env antes de iniciar o banco.');
  }

  const sqlPath = join(__dirname, '..', 'utils', 'init_db.sql');
  const sql = await readFile(sqlPath, 'utf-8');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.query(sql);
    console.log('Banco inicializado com sucesso.');
  } finally {
    await pool.end();
  }
};

initDb().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Falha ao inicializar banco:', message);
  process.exit(1);
});
