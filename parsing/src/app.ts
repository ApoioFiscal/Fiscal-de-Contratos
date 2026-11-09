import 'dotenv/config';
import express from 'express';
import cors from 'cors'; // Importando o CORS
import uploadRouter from './routes/upload';

// App Express exportado como default export: é assim que a Vercel detecta o
// serviço (zero-config de Express) e o executa como uma única Function.
// O `src/index.ts` só sobe o listener no desenvolvimento local.
export const app = express();

// Liberando o CORS
app.use(cors());

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.use('/upload', uploadRouter);

app.get('/', (_req, res) => {
  res.json({
    servico: 'API de Parsing de PDF',
    parser: process.env.PARSER_MODE ?? 'rules',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
