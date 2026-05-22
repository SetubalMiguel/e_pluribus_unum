/**
 * Cliente HTTP tipado para a API FastAPI do pluribus unum.
 *
 * Lê NEXT_PUBLIC_API_URL (default: http://localhost:8000) e expõe um
 * `apiFetch<T>` genérico que trata erros HTTP, mais funções específicas
 * para cada recurso (animals, inseminations, predict, recommend, stats).
 */

import type {
  Animal,
  AnimalCreate,
  AnimalListParams,
  AnimalListResponse,
  AnimalUpdate,
  DadosGeneticosFemea,
  DadosGeneticosMacho,
  Ciclo,
  CicloCreate,
  CicloListParams,
  CicloListResponse,
  CicloUpdate,
  Inseminacao,
  InseminacaoCreate,
  InseminacaoListParams,
  InseminacaoListResponse,
  InseminacaoUpdate,
  PredictRequest,
  PredictResponse,
  RecommendRequest,
  RecommendResponse,
  StatsResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** Serializa params para query string, ignorando undefined/null. */
function buildQuery(params?: object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Fetch tipado genérico. Lança ApiError em status >= 400, tentando extrair
 * a mensagem do corpo (FastAPI usa `detail`).
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Falha de rede ao chamar ${path}: ${cause}`);
  }

  // 204 No Content — sem corpo.
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail =
      (payload && typeof payload === "object" && "detail" in payload
        ? (payload as { detail: unknown }).detail
        : null) ?? response.statusText;
    const message =
      typeof detail === "string"
        ? detail
        : `Erro HTTP ${response.status} em ${path}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

// --------------------------- Animals ---------------------------------------

export function listAnimals(
  params?: AnimalListParams,
  init?: RequestInit,
): Promise<AnimalListResponse> {
  return apiFetch<AnimalListResponse>(`/animals${buildQuery(params)}`, init);
}

export function getAnimal(id: string, init?: RequestInit): Promise<Animal> {
  return apiFetch<Animal>(`/animals/${id}`, init);
}

export function createAnimal(
  body: AnimalCreate,
  init?: RequestInit,
): Promise<Animal> {
  return apiFetch<Animal>(`/animals`, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAnimal(
  id: string,
  body: AnimalUpdate,
  init?: RequestInit,
): Promise<Animal> {
  return apiFetch<Animal>(`/animals/${id}`, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteAnimal(id: string, init?: RequestInit): Promise<void> {
  return apiFetch<void>(`/animals/${id}`, { ...init, method: "DELETE" });
}

/**
 * Atualização parcial dos dados genéticos com validação tipada por sexo
 * no backend (rota `PATCH /animals/{id}/dados-geneticos`). Mescla com o
 * que já existe — só envie os campos que mudaram.
 */
export function updateAnimalGeneticData(
  id: string,
  body: Partial<DadosGeneticosFemea> | Partial<DadosGeneticosMacho>,
  init?: RequestInit,
): Promise<Animal> {
  return apiFetch<Animal>(`/animals/${id}/dados-geneticos`, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// --------------------------- Inseminations ---------------------------------

export function listInseminations(
  params?: InseminacaoListParams,
  init?: RequestInit,
): Promise<InseminacaoListResponse> {
  return apiFetch<InseminacaoListResponse>(
    `/inseminations${buildQuery(params)}`,
    init,
  );
}

/** Alias mantido para conveniência (mesmo retorno de listInseminations). */
export const getInseminations = listInseminations;

export function createInsemination(
  body: InseminacaoCreate,
  init?: RequestInit,
): Promise<Inseminacao> {
  return apiFetch<Inseminacao>(`/inseminations`, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateInsemination(
  id: string,
  body: InseminacaoUpdate,
  init?: RequestInit,
): Promise<Inseminacao> {
  return apiFetch<Inseminacao>(`/inseminations/${id}`, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// --------------------------- Cycles ---------------------------------------

export function listCycles(
  params?: CicloListParams,
  init?: RequestInit,
): Promise<CicloListResponse> {
  return apiFetch<CicloListResponse>(`/cycles${buildQuery(params)}`, init);
}

export function getCycle(id: string, init?: RequestInit): Promise<Ciclo> {
  return apiFetch<Ciclo>(`/cycles/${id}`, init);
}

export function createCycle(
  body: CicloCreate,
  init?: RequestInit,
): Promise<Ciclo> {
  return apiFetch<Ciclo>(`/cycles`, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateCycle(
  id: string,
  body: CicloUpdate,
  init?: RequestInit,
): Promise<Ciclo> {
  return apiFetch<Ciclo>(`/cycles/${id}`, {
    ...init,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteCycle(id: string, init?: RequestInit): Promise<void> {
  return apiFetch<void>(`/cycles/${id}`, { ...init, method: "DELETE" });
}

// --------------------------- IA: predict / recommend -----------------------

export function predict(
  body: PredictRequest,
  init?: RequestInit,
): Promise<PredictResponse> {
  return apiFetch<PredictResponse>(`/predict`, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function recommend(
  body: RecommendRequest,
  init?: RequestInit,
): Promise<RecommendResponse> {
  return apiFetch<RecommendResponse>(`/recommend`, {
    ...init,
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --------------------------- Dashboard ------------------------------------

export function getStats(init?: RequestInit): Promise<StatsResponse> {
  return apiFetch<StatsResponse>(`/stats`, init);
}
