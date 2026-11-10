import "dotenv/config";
import express from "express";
import cors from "cors"; // Importando o CORS
import { router } from "./routes";
import { errorHandler } from "./common/middleware";

export const app = express();

// Liberando o CORS para aceitar requisições do frontend
app.use(cors());

app.use(express.json({ limit: "10mb" }));
// Importação de contrato: o PDF cru chega aqui antes do parser JSON.
app.use(express.raw({ type: "application/pdf", limit: "20mb" }));
app.use("/api", router);

// Health check para monitoramento externo
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
// Também exposto sob /api para quem só conhece o prefixo dos endpoints
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Middleware de tratamento de erros
app.use(errorHandler);

export default app;
