import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * O seed de desenvolvimento não cria mais contratos. O E2E depende do contrato
 * real (00141/2026-SDC) para pedidos/estoque/avaliações, então garante a fixture
 * direto no banco antes de subir o backend/Vite.
 */
export default function globalSetup() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const backend = path.resolve(here, "../../backend");

  execFileSync("npm", ["run", "seed:contrato-e2e"], {
    cwd: backend,
    stdio: "inherit",
    shell: true,
  });
}
