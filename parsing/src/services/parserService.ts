import { extractWithOllama, ParserExtraction } from './ollamaService';
import { extractWithRules } from './rulesParserService';

const configuredParserMode = (process.env.PARSER_MODE ?? 'rules').trim().toLowerCase();

if (configuredParserMode !== 'rules' && configuredParserMode !== 'ollama') {
  throw new Error('PARSER_MODE invalido. Use "rules" ou "ollama".');
}

const PARSER_MODE: 'rules' | 'ollama' = configuredParserMode;

const withParserMetadata = (
  extraction: ParserExtraction,
  parserUsed: 'ollama' | 'rules' | 'rules_fallback',
  fallbackReason?: string,
): ParserExtraction => ({
  resumo: extraction.resumo,
  dados: {
    ...extraction.dados,
    parser_used: parserUsed,
    fallback_reason: fallbackReason ?? null,
  },
});

export const extractStructuredData = async (text: string): Promise<ParserExtraction> => {
  if (PARSER_MODE === 'ollama') {
    try {
      const extraction = await extractWithOllama(text);
      return withParserMetadata(extraction, 'ollama');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido no Ollama';
      console.warn(`Ollama indisponivel, usando parser por regras. Motivo: ${message}`);

      const fallbackExtraction = extractWithRules(text);
      return withParserMetadata(fallbackExtraction, 'rules_fallback', message);
    }
  }

  const extraction = extractWithRules(text);
  return withParserMetadata(extraction, 'rules');
};
