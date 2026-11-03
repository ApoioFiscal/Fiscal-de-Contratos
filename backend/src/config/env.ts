// URL do serviço de parsing (o frontend envia o PDF cru aqui; o backend faz o proxy).
export const PARSING_URL = process.env.PARSING_URL ?? "http://localhost:3000";
