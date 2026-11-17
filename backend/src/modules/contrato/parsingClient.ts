import { PARSING_URL } from "../../config/env";
import { AppError, ErrorCode, ValidationError } from "../../common/errors";

export type ImportacaoPdf = {
  buffer: Buffer;
  nomeOriginal: string;
};

export type ImportacaoParsingResult = {
  contrato: unknown;
  avisos: string[];
};

const PARSER_TIMEOUT_MS = Number(process.env.PARSING_TIMEOUT_MS ?? 120000);

/** Erro do serviço de parsing, já traduzido para algo que o usuário consegue entender. */
export class ParsingServiceError extends AppError {
  constructor(message: string, statusCode = 502, details?: Record<string, unknown>) {
    super(ErrorCode.INTERNAL_ERROR, message, statusCode, details);
    this.name = "ParsingServiceError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Proxy para o serviço de parsing (`PARSING_URL`): o frontend envia o PDF cru, o backend
 * encaminha ao parsing, que faz a extração e devolve o `structured_data`.
 *
 * O backend é quem valida com o Zod e persiste — assim a extração deixa de ser feita no
 * browser e passa a ser confiável (e auditável).
 */
export class ParsingClient {
  private async enviar(formData: FormData): Promise<Response> {
    // No plano free do Render o serviço "dorme" e a 1ª chamada falha/demora: 1 nova tentativa.
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        return await fetch(`${PARSING_URL}/upload`, {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(PARSER_TIMEOUT_MS),
        });
      } catch (error) {
        ultimoErro = error;
        if (tentativa === 1) await sleep(3000);
      }
    }

    const motivo = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
    const causa = (ultimoErro as { cause?: { code?: string } } | undefined)?.cause?.code;
    throw new ParsingServiceError(
      `Não foi possível conectar ao serviço de parsing em ${PARSING_URL} (${causa ?? motivo}). ` +
        "Verifique a variável PARSING_URL do backend e se o serviço de parsing está no ar.",
    );
  }

  async importarDocumento({ buffer, nomeOriginal }: ImportacaoPdf): Promise<ImportacaoParsingResult> {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError(
        "Nenhum PDF recebido. Envie o arquivo com Content-Type application/pdf.",
      );
    }

    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const formData = new FormData();
    formData.append("file", new Blob([arrayBuffer], { type: "application/pdf" }), nomeOriginal);

    const response = await this.enviar(formData);

    if (!response.ok) {
      type ErroParsing = { erro?: string; error?: string; detalhes?: string };
      const detalhes: ErroParsing | null = await response
        .json()
        .then((corpo) => corpo as ErroParsing)
        .catch(() => null);
      const msg = [detalhes?.erro ?? detalhes?.error, detalhes?.detalhes].filter(Boolean).join(": ");
      const status = response.status === 422 || response.status === 400 ? 422 : 502;
      throw new ParsingServiceError(
        `O serviço de parsing recusou o PDF (HTTP ${response.status})${msg ? `: ${msg}` : "."}`,
        status,
      );
    }

    const payload = (await response.json()) as {
      sucesso?: boolean;
      documento?: { structured_data?: { contrato?: { avisos?: string[] }; tipo_documento?: string } };
    };

    const contrato = payload.documento?.structured_data?.contrato;
    if (!payload.sucesso || !contrato) {
      const tipo = payload.documento?.structured_data?.tipo_documento;
      throw new ParsingServiceError(
        `O documento não foi reconhecido como um termo de contrato${tipo ? ` (detectado: ${tipo})` : ""}. ` +
          "Confira se o PDF é o contrato assinado (e não edital, TR ou nota fiscal).",
        422,
      );
    }

    // Os avisos da extração ficam dentro do próprio bloco `contrato`.
    const avisos = Array.isArray(contrato.avisos) ? contrato.avisos : [];

    return { contrato, avisos };
  }
}
