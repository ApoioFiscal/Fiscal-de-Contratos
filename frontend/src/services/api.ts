const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const REQUEST_TIMEOUT_MS = 15000;

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  error?: ApiErrorPayload;
}

type TratadorNaoAutorizado = () => void;

let tratarNaoAutorizado: TratadorNaoAutorizado | null = null;

export function definirTratadorNaoAutorizado(handler: TratadorNaoAutorizado): void {
  tratarNaoAutorizado = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiSuccessResponse<T>(value: unknown): value is ApiSuccessResponse<T> {
  return isRecord(value) && value.success === true && "data" in value;
}

function getErrorPayload(value: unknown): ApiErrorPayload | undefined {
  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  const response = value as ApiErrorResponse;
  return response.error;
}

function buildUrl(path: string): string {
  if (path.startsWith("/api/")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  const token = localStorage.getItem("token");

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const payload = getErrorPayload(body);

      if (response.status === 401 && token) {
        tratarNaoAutorizado?.();
      }

      throw new ApiError(
        payload?.message || "Não foi possível concluir a operação.",
        response.status,
        payload?.code,
        payload?.details,
      );
    }

    if (!isApiSuccessResponse<T>(body)) {
      throw new ApiError("Resposta inesperada do servidor.", response.status);
    }

    return body.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Tempo limite excedido ao conectar com o servidor.", 408, "TIMEOUT");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
