import 'dotenv/config';
import express from 'express';
import cors from 'cors'; // Importando o CORS
import uploadRouter from './routes/upload';

const app = express();
const port = process.env.PORT || 3000;

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

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});