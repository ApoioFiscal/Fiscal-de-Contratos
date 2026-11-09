import 'dotenv/config';
import app from './app';

const port = process.env.PORT || 3000;

// Na Vercel o app é importado e executado como Function; não há listener.
// Localmente (npm run dev) subimos o servidor normalmente.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

export default app;
