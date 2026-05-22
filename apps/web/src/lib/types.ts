/**
 * Tipos TypeScript que espelham os schemas Pydantic do backend FastAPI.
 *
 * Os enums vêm do backend como `str, Enum`, e o que trafega no JSON é o
 * VALOR (não o nome). Por isso:
 *   - Especie  → "bovino" | "ovino" | "caprino"   (e não BOVINO/OVINO/CAPRINO)
 *   - Sexo     → "M" | "F"                         (e não MACHO/FEMEA)
 *
 * Mantemos enums como unions de literais para evitar dores de cabeça com
 * `enum` do TS (que não é apagado no build, gera código JS, etc.).
 */

// --------------------------- Enums (wire values) ---------------------------

export type Especie = "bovino" | "ovino" | "caprino";

export type Sexo = "M" | "F";

export type Tecnica =
  | "IATF"
  | "convencional"
  | "IA_repasse"
  | "IA_cervical"
  | "IA_laparoscopica";

export type ResultadoDiagnostico = "prenhe" | "vazia" | "aguardando";

export type Classificacao = "alta" | "media" | "baixa";

// Rótulos amigáveis para a UI (PT-BR).
export const ESPECIE_LABEL: Record<Especie, string> = {
  bovino: "Bovinos",
  ovino: "Ovinos",
  caprino: "Caprinos",
};

export const SEXO_LABEL: Record<Sexo, string> = {
  M: "Macho",
  F: "Fêmea",
};

export const RESULTADO_LABEL: Record<ResultadoDiagnostico, string> = {
  prenhe: "Prenhe",
  vazia: "Vazia",
  aguardando: "Aguardando",
};

// --------------------------- Dados genéticos --------------------------------
// Espelham os schemas Pydantic DadosGeneticosFemea/Macho. Campos com `?`
// são opcionais — o backend calcula automaticamente quando omitidos.

export interface DadosGeneticosFemea {
  ecc: number; // 1.0 – 5.0 (ECC, ideal 3.0–3.5)
  paridade: number; // 0 – 15 (número de partos prévios)
  idade_anos: number; // 0 – 25
  historico_sucesso?: number | null; // 0 – 1 (auto-calc se omitido)
}

export interface DadosGeneticosMacho {
  idade_anos: number; // 0 – 20
  taxa_sucesso_historica?: number | null; // 0 – 1 (auto-calc se omitido)
}

export type DadosGeneticos = DadosGeneticosFemea | DadosGeneticosMacho;

// --------------------------- Animais ---------------------------------------

export interface Animal {
  id: string;
  especie: Especie;
  identificacao: string;
  sexo: Sexo;
  raca: string | null;
  linhagem: string | null;
  origem: string | null;
  data_nascimento: string | null; // ISO date
  dados_geneticos: Record<string, unknown>;
  ativo: boolean;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface AnimalCreate {
  especie: Especie;
  identificacao: string;
  sexo: Sexo;
  raca?: string | null;
  linhagem?: string | null;
  origem?: string | null;
  data_nascimento?: string | null;
  dados_geneticos?: Record<string, unknown>;
}

export interface AnimalUpdate {
  raca?: string | null;
  linhagem?: string | null;
  origem?: string | null;
  data_nascimento?: string | null;
  dados_geneticos?: Record<string, unknown> | null;
  ativo?: boolean;
}

export interface AnimalListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Animal[];
}

export interface AnimalResumo {
  id: string;
  identificacao: string;
  especie: Especie;
  raca: string | null;
  linhagem: string | null;
}

// --------------------------- Inseminações ----------------------------------

export interface Inseminacao {
  id: string;
  matriz_id: string;
  reprodutor_id: string | null;
  semen_externo: Record<string, unknown> | null;
  data_evento: string; // ISO datetime
  tecnica: Tecnica;
  inseminador: string | null;
  observacoes: string | null;
  resultado_diagnostico: ResultadoDiagnostico;
  data_diagnostico: string | null; // ISO date
  predicao_prenhez: number | null;
  modelo_versao: string | null;
  created_at: string;
  updated_at: string;
}

export interface InseminacaoCreate {
  matriz_id: string;
  reprodutor_id?: string | null;
  semen_externo?: Record<string, unknown> | null;
  data_evento: string; // ISO datetime
  tecnica: Tecnica;
  inseminador?: string | null;
  observacoes?: string | null;
  predicao_prenhez?: number | null;
  predicao_features?: Record<string, unknown> | null;
  modelo_versao?: string | null;
}

export interface InseminacaoUpdate {
  resultado_diagnostico?: ResultadoDiagnostico | null;
  data_diagnostico?: string | null;
  observacoes?: string | null;
}

export interface InseminacaoListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Inseminacao[];
}

// --------------------------- Predição ---------------------------------------

export interface PredictRequest {
  matriz_id: string;
  reprodutor_id: string;
  tecnica: Tecnica;
  data_evento: string; // ISO date (YYYY-MM-DD)
}

export interface FatorPredicao {
  feature: string;
  valor: number;
  impacto_relativo: number;
}

export interface PredictResponse {
  probabilidade_prenhez: number; // 0..1
  classificacao: Classificacao | string;
  fatores_positivos: FatorPredicao[];
  fatores_negativos: FatorPredicao[];
  modelo_versao: string;
  auc_referencia: number;
}

// --------------------------- Recomendação ----------------------------------

export interface RecommendRequest {
  matriz_id: string;
  tecnica?: Tecnica;
  data_evento: string; // ISO date
  top_n?: number;
  filtrar_parentesco?: boolean;
}

export interface RecomendacaoItem {
  rank: number;
  reprodutor: AnimalResumo;
  probabilidade_prenhez: number;
  classificacao: Classificacao | string;
  fatores_positivos: FatorPredicao[];
  fatores_negativos: FatorPredicao[];
}

export interface RecommendResponse {
  matriz: AnimalResumo;
  total_reprodutores_avaliados: number;
  total_filtrados_por_parentesco: number;
  modelo_versao: string;
  auc_referencia: number;
  recomendacoes: RecomendacaoItem[];
}

// --------------------------- Estatísticas ----------------------------------

export interface EstatisticaEspecie {
  especie: Especie;
  total_animais: number;
  total_matrizes: number;
  total_reprodutores: number;
  total_inseminacoes: number;
  taxa_prenhez_pct: number;
  inseminacoes_aguardando: number;
}

export interface StatsResponse {
  total_animais: number;
  total_inseminacoes: number;
  taxa_prenhez_geral_pct: number;
  por_especie: EstatisticaEspecie[];
}

// --------------------------- Filtros de listagem ---------------------------

export interface AnimalListParams {
  especie?: Especie;
  sexo?: Sexo;
  ativo?: boolean;
  busca?: string;
  page?: number;
  page_size?: number;
}

export interface InseminacaoListParams {
  matriz_id?: string;
  especie?: Especie;
  resultado?: ResultadoDiagnostico;
  page?: number;
  page_size?: number;
}

// --------------------------- Ciclos Reprodutivos ---------------------------

export type StatusCiclo = "ativo" | "concluido_sucesso" | "concluido_falha";

export const STATUS_CICLO_LABEL: Record<StatusCiclo, string> = {
  ativo: "Ativo",
  concluido_sucesso: "Concluído com sucesso",
  concluido_falha: "Concluído com falha",
};

export interface CicloAnimalBrief {
  id: string;
  identificacao: string;
  especie: Especie;
}

export interface Ciclo {
  id: string;
  matriz: CicloAnimalBrief;
  data_inicio: string; // ISO date
  data_fim: string | null;
  status: StatusCiclo;
  parto_data: string | null;
  cria: CicloAnimalBrief | null;
  created_at: string;
  updated_at: string;
}

export interface CicloCreate {
  matriz_id: string;
  data_inicio: string;
  data_fim?: string | null;
  status?: StatusCiclo;
  parto_data?: string | null;
  cria_id?: string | null;
}

export interface CicloUpdate {
  data_fim?: string | null;
  status?: StatusCiclo;
  parto_data?: string | null;
  cria_id?: string | null;
}

export interface CicloListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Ciclo[];
}

export interface CicloListParams {
  matriz_id?: string;
  especie?: Especie;
  status?: StatusCiclo;
  page?: number;
  page_size?: number;
}
