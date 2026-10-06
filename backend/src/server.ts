import "dotenv/config";
import express from "express";
import cors from "cors"; // Importando o CORS
import { router } from "./routes";
import { errorHandler } from "./common/middleware";

const app = express();
const PORT = process.env.PORT ?? 3333; 

// Liberando o CORS para aceitar requisições do frontend (localhost:5173)
app.use(cors());

app.use(express.json());
app.use("/api", router);

// Health check para monitoramento externo (Render/Vercel/professor)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
// Também exposto sob /api para quem só conhece o prefixo dos endpoints
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Middleware de tratamento de erros 
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});