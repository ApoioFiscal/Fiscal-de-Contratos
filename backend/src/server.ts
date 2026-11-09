import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT ?? 3333;

// Na Vercel o app é importado e executado como Function; não há listener.
// Localmente (npm run dev) subimos o servidor normalmente.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
