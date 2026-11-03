import { PARSING_URL } from "../../config/env";

export type ImportacaoPdf = {
  buffer: Buffer;
  nomeOriginal: string;
};

export type ImportacaoParsingResult = {
  contrato: unknown;
  avisos: string[];
};

const PARSER_TIMEOUT_MS = Number(process.env.PARSING_TIMEOUT_MS ?? 120000);

/**
 * Proxy para o serviço de parsing (`PARSING_URL`): o frontend envia o PDF cru, o backend
 * encaminha ao parsing, que faz a extração e devolve o `structured_data`.
 *
 * O backend é quem valida com o Zod e persiste — assim a extração deixa de ser feita no
 * browser e passa a ser confiável (e auditável).
 */
export class ParsingClient {
  async importarDocumento({ buffer, nomeOriginal }: ImportacaoPdf): Promise<ImportacaoParsingResult> {
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const formData = new FormData();
    formData.append("file", new Blob([arrayBuffer], { type: "application/pdf" }), nomeOriginal);

    const response = await fetch(`${PARSING_URL}/upload`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(PARSER_TIMEOUT_MS),
    });

    if (!response.ok) {
      let detalhes: unknown = null;
      try {
        detalhes = await response.json();
      } catch {
        detalhes = null;
      }
      throw new Error(
        `Falha ao processar o PDF no serviço de parsing (HTTP ${response.status}): ${JSON.stringify(
          detalhes,
        )}`,
      );
    }

    const payload = (await response.json()) as {
      sucesso?: boolean;
      documento?: { structured_data?: { contrato?: unknown } };
    };

    if (!payload.sucesso || !payload.documento?.structured_data?.contrato) {
      throw new Error("O serviço de parsing não devolveu o bloco `contrato` para este documento.");
    }

    const contrato = payload.documento.structured_data.contrato;
    const dados = payload.documento.structured_data as Record<string, unknown>;
    const avisos = Array.isArray(dados.avisos) ? (dados.avisos as string[]) : [];

    return { contrato, avisos };
  }
}
