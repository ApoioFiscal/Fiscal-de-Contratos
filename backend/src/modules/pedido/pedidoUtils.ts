/**
 * Lógica pura do fluxo de pedidos (sem dependências externas),
 * extraída para permitir testes unitários sem banco de dados.
 */

/** Normaliza a sigla do setor para o formato usado na Ordem de Compra. */
export function normalizarSigla(sigla?: string | null): string {
  const normalizada = (sigla ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  return normalizada || "SEC";
}

/** Gera o número da Ordem de Compra no padrão OC-<SIGLA>-<seq>. */
export function gerarNumeroOrdem(sigla: string | null | undefined, seq: number): string {
  return `OC-${normalizarSigla(sigla)}-${String(seq).padStart(3, "0")}`;
}