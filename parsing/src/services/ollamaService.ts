export type ParserExtraction = {
  resumo: string;
  dados: Record<string, unknown>;
};

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma';
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? '10m';
const parsedTimeout = Number(process.env.OLLAMA_TIMEOUT_MS ?? 30000);
const OLLAMA_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

const buildPrompt = (text: string) => `
Voce e um parser de documentos publicos brasileiros.
Extraia os dados importantes do texto abaixo e responda somente JSON valido.
Nao use markdown. Nao invente informacoes.

Regras:
- Preserve nomes, orgaos, datas, horarios, valores, CNPJ, CPF, telefones, enderecos, URLs e numeros de processo.
- Quando houver itens, arquivos, contratos, fases ou responsaveis, use arrays.
- Se uma informacao nao existir, use null ou array vazio.
- Mantenha o texto original em campos quando houver duvida.

Formato obrigatorio:
{
  "resumo": "resumo curto do documento",
  "dados": {
    "tipo_documento": null,
    "orgao": null,
    "processo": null,
    "modalidade": null,
    "objeto": null,
    "situacao": null,
    "datas": [],
    "valores": [],
    "responsaveis": [],
    "contratos": [],
    "empresas": [],
    "documentos": [],
    "enderecos": [],
    "telefones": [],
    "urls": [],
    "observacoes": []
  }
}

Texto:
${text}
`;

const extractJson = (value: string) => {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('O Ollama nao retornou JSON valido.');
  }

  return value.slice(start, end + 1);
};

export const extractWithOllama = async (text: string): Promise<ParserExtraction> => {
  let response: Response;

  try {
    response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: buildPrompt(text),
        stream: false,
        format: 'json',
        keep_alive: OLLAMA_KEEP_ALIVE,
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error(`O Ollama excedeu o limite de ${OLLAMA_TIMEOUT_MS} ms.`);
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Falha ao chamar Ollama: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const rawResponse = String(payload.response ?? '');
  const parsed = JSON.parse(extractJson(rawResponse)) as Partial<ParserExtraction>;

  return {
    resumo: parsed.resumo ?? '',
    dados: parsed.dados ?? {},
  };
};
