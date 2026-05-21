"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Crown,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AnimalSearchInput } from "@/components/animal-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnimal, recommend } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  Animal,
  FatorPredicao,
  RecomendacaoItem,
  RecommendResponse,
  Tecnica,
} from "@/lib/types";

// --------------------------- Constantes ------------------------------------

const TECNICA_OPTIONS: { value: Tecnica; label: string }[] = [
  { value: "IATF", label: "IATF (sincronização)" },
  { value: "convencional", label: "Monta natural" },
  { value: "IA_repasse", label: "IA com repasse" },
  { value: "IA_cervical", label: "IA cervical" },
  { value: "IA_laparoscopica", label: "IA laparoscópica" },
];

const CLASSIFICACAO_LABEL: Record<string, string> = {
  alta: "Alta probabilidade",
  media: "Probabilidade média",
  baixa: "Probabilidade baixa",
};

// --------------------------- Página ----------------------------------------

export default function RecomendacoesPage() {
  const [matriz, setMatriz] = useState<Animal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica>("IATF");
  const [dataEvento, setDataEvento] = useState<string>(() => todayISODate());
  const [filtrarParentesco, setFiltrarParentesco] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RecommendResponse | null>(null);

  // Detalhes completos do reprodutor (para mostrar idade) — preenchido após o /recommend.
  const [reprodutorDetails, setReprodutorDetails] = useState<
    Record<string, Animal>
  >({});

  // Ao trocar de matriz, descarta resultados antigos.
  useEffect(() => {
    setResponse(null);
    setReprodutorDetails({});
    setError(null);
  }, [matriz?.id]);

  // Quando uma resposta chega, busca os animais completos em paralelo para
  // exibir idade. Falhas individuais são silenciosas (idade fica "—").
  useEffect(() => {
    if (!response || response.recomendacoes.length === 0) return;
    let active = true;
    Promise.all(
      response.recomendacoes.map((r) =>
        getAnimal(r.reprodutor.id)
          .then((a) => [r.reprodutor.id, a] as const)
          .catch(() => [r.reprodutor.id, null] as const),
      ),
    ).then((entries) => {
      if (!active) return;
      const next: Record<string, Animal> = {};
      for (const [id, animal] of entries) {
        if (animal) next[id] = animal;
      }
      setReprodutorDetails(next);
    });
    return () => {
      active = false;
    };
  }, [response]);

  const onGenerate = useCallback(async () => {
    if (!matriz) {
      setError("Selecione uma matriz para começar.");
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    setReprodutorDetails({});
    try {
      const res = await recommend({
        matriz_id: matriz.id,
        tecnica,
        data_evento: dataEvento,
        top_n: 5,
        filtrar_parentesco: filtrarParentesco,
      });
      setResponse(res);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar recomendações";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [matriz, tecnica, dataEvento, filtrarParentesco]);

  const recomendacoes = response?.recomendacoes ?? [];
  const top = recomendacoes[0];
  const restante = recomendacoes.slice(1);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          Recomendações da IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Encontre o reprodutor com maior probabilidade de prenhez para cada
          matriz, com filtro opcional de parentesco.
        </p>
      </header>

      {/* Setup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Escolha a matriz</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AnimalSearchInput
            sexo="F"
            value={matriz}
            onChange={setMatriz}
            placeholder="Buscar matriz por identificação…"
            inputId="rec-matriz"
          />

          {matriz ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rec-tecnica">Técnica</Label>
                  <Select
                    value={tecnica}
                    onValueChange={(v) => setTecnica(v as Tecnica)}
                  >
                    <SelectTrigger id="rec-tecnica">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TECNICA_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rec-data">Data prevista</Label>
                  <Input
                    id="rec-data"
                    type="date"
                    value={dataEvento}
                    onChange={(e) => setDataEvento(e.target.value)}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filtrarParentesco}
                  onChange={(e) => setFiltrarParentesco(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                Filtrar reprodutores com possível parentesco
              </label>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onGenerate}
                  disabled={loading || !dataEvento}
                  className="w-full sm:w-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Gerando…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Gerar recomendações
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Estado de erro */}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Estado vazio inicial / após troca de matriz */}
      {!loading && !response && !error && matriz ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Clique em <strong>Gerar recomendações</strong> para rodar a IA com a
          técnica e a data acima.
        </div>
      ) : null}

      {/* Loading */}
      {loading ? <ResultsSkeleton /> : null}

      {/* Resultados */}
      {response && !loading ? (
        <section className="flex flex-col gap-4">
          <MetaInfo response={response} />

          {recomendacoes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum reprodutor compatível encontrado com esses critérios.
              Tente desligar o filtro de parentesco ou mudar a técnica.
            </div>
          ) : (
            <>
              {/* Top 1 — destaque (full-width em desktop) */}
              {top ? (
                <TopRecommendationCard
                  rec={top}
                  matriz={matriz!}
                  tecnica={tecnica}
                  dataEvento={dataEvento}
                  detail={reprodutorDetails[top.reprodutor.id]}
                />
              ) : null}

              {/* Demais — 2 colunas em desktop, empilhados em mobile */}
              {restante.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {restante.map((rec) => (
                    <RecommendationCard
                      key={rec.reprodutor.id}
                      rec={rec}
                      matriz={matriz!}
                      tecnica={tecnica}
                      dataEvento={dataEvento}
                      detail={reprodutorDetails[rec.reprodutor.id]}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

// --------------------------- Meta info --------------------------------------

function MetaInfo({ response }: { response: RecommendResponse }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
      <span>
        Avaliamos{" "}
        <strong className="text-foreground">
          {response.total_reprodutores_avaliados}
        </strong>{" "}
        reprodutores
        {response.total_filtrados_por_parentesco > 0 ? (
          <>
            ; filtramos{" "}
            <strong className="text-foreground">
              {response.total_filtrados_por_parentesco}
            </strong>{" "}
            por parentesco
          </>
        ) : null}
        .
      </span>
      <span aria-hidden className="hidden sm:inline">
        ·
      </span>
      <span>
        Modelo {response.modelo_versao} · AUC ROC{" "}
        {response.auc_referencia.toFixed(2)}
      </span>
    </div>
  );
}

// --------------------------- Card de recomendação --------------------------

interface RecommendationCardProps {
  rec: RecomendacaoItem;
  matriz: Animal;
  tecnica: Tecnica;
  dataEvento: string;
  detail?: Animal;
}

function RecommendationCard({
  rec,
  matriz,
  tecnica,
  dataEvento,
  detail,
}: RecommendationCardProps) {
  const pct = Math.round(rec.probabilidade_prenhez * 100);
  const tone = predictionTone(pct);
  const idade = formatIdade(detail);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <RankBadge rank={rec.rank} />
          <div className="flex flex-1 flex-col">
            <CardTitle className="text-base">
              {rec.reprodutor.identificacao}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {rec.reprodutor.raca ?? "Raça não informada"}
              {idade ? ` · ${idade}` : ""}
              {rec.reprodutor.linhagem ? ` · ${rec.reprodutor.linhagem}` : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ProbabilityBlock pct={pct} tone={tone} classificacao={rec.classificacao} />
        <FactorsList items={rec.fatores_positivos.slice(0, 3)} kind="positive" />
        <SelectAction
          matriz={matriz}
          reprodutorId={rec.reprodutor.id}
          tecnica={tecnica}
          dataEvento={dataEvento}
        />
      </CardContent>
    </Card>
  );
}

function TopRecommendationCard({
  rec,
  matriz,
  tecnica,
  dataEvento,
  detail,
}: RecommendationCardProps) {
  const pct = Math.round(rec.probabilidade_prenhez * 100);
  const tone = predictionTone(pct);
  const idade = formatIdade(detail);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground shadow-sm">
              #{rec.rank}
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Top recomendação
                </span>
              </div>
              <CardTitle className="text-xl sm:text-2xl">
                {rec.reprodutor.identificacao}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {rec.reprodutor.raca ?? "Raça não informada"}
                {idade ? ` · ${idade}` : ""}
                {rec.reprodutor.linhagem ? ` · ${rec.reprodutor.linhagem}` : ""}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="flex flex-col gap-3 lg:col-span-1">
          <ProbabilityBlock
            pct={pct}
            tone={tone}
            classificacao={rec.classificacao}
            big
          />
        </div>
        <div className="lg:col-span-2">
          <FactorsList
            items={rec.fatores_positivos.slice(0, 3)}
            kind="positive"
            wide
          />
        </div>
        <div className="lg:col-span-3">
          <SelectAction
            matriz={matriz}
            reprodutorId={rec.reprodutor.id}
            tecnica={tecnica}
            dataEvento={dataEvento}
            big
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------- Subcomponentes --------------------------------

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-semibold",
        "bg-primary/10 text-primary",
      )}
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  );
}

function ProbabilityBlock({
  pct,
  tone,
  classificacao,
  big,
}: {
  pct: number;
  tone: { bar: string; badge: "success" | "warning" | "destructive" };
  classificacao: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums",
            big ? "text-5xl" : "text-3xl",
          )}
        >
          {pct}%
        </span>
        <Badge variant={tone.badge}>
          {CLASSIFICACAO_LABEL[classificacao] ?? classificacao}
        </Badge>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Probabilidade de prenhez"
      >
        <div
          className={cn("h-full transition-all", tone.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function FactorsList({
  items,
  kind,
  wide,
}: {
  items: FatorPredicao[];
  kind: "positive" | "negative";
  wide?: boolean;
}) {
  const Icon = kind === "positive" ? TrendingUp : TrendingDown;
  const color = kind === "positive" ? "text-success" : "text-destructive";
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", color)} aria-hidden />
        Favorecem o sucesso
      </div>
      <ul
        className={cn(
          "flex flex-col gap-1",
          wide ? "sm:grid sm:grid-cols-3 sm:gap-2" : null,
        )}
      >
        {items.map((f, i) => (
          <li
            key={`${f.feature}-${i}`}
            className="flex items-center justify-between gap-2 rounded-md bg-success/10 px-2.5 py-1.5 text-sm"
          >
            <span className="truncate text-success">{f.feature}</span>
            <span className="text-xs font-semibold tabular-nums text-success">
              +{f.impacto_relativo.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectAction({
  matriz,
  reprodutorId,
  tecnica,
  dataEvento,
  big,
}: {
  matriz: Animal;
  reprodutorId: string;
  tecnica: Tecnica;
  dataEvento: string;
  big?: boolean;
}) {
  const params = new URLSearchParams({
    matriz_id: matriz.id,
    reprodutor_id: reprodutorId,
    tecnica,
    data_evento: dataEvento,
  });
  return (
    <Button asChild size={big ? "lg" : "default"} className="w-full">
      <Link href={`/inseminacoes/nova?${params.toString()}`}>
        <Sparkles className="h-4 w-4" aria-hidden />
        Selecionar e registrar inseminação
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Button>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-full" />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --------------------------- Helpers ---------------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISODate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function predictionTone(pct: number): {
  bar: string;
  badge: "success" | "warning" | "destructive";
} {
  if (pct >= 70) return { bar: "bg-success", badge: "success" };
  if (pct >= 45) return { bar: "bg-warning", badge: "warning" };
  return { bar: "bg-destructive", badge: "destructive" };
}

/** Idade formatada a partir de dados_geneticos.idade_anos ou data_nascimento. */
function formatIdade(animal?: Animal | null): string | null {
  if (!animal) return null;
  if (animal.data_nascimento) {
    const nasc = new Date(animal.data_nascimento);
    if (!Number.isNaN(nasc.getTime())) {
      const diffMs = Date.now() - nasc.getTime();
      const totalMonths = Math.max(
        0,
        Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375)),
      );
      const years = Math.floor(totalMonths / 12);
      const months = totalMonths % 12;
      if (years === 0) return `${months}m`;
      if (months === 0) return `${years} anos`;
      return `${years}a ${months}m`;
    }
  }
  const raw = animal.dados_geneticos?.["idade_anos"];
  if (typeof raw !== "number") return null;
  const years = Math.floor(raw);
  const months = Math.round((raw - years) * 12);
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years} anos`;
  return `${years}a ${months}m`;
}

