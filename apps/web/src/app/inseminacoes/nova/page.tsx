"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Loader2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AnimalSearchInput } from "@/components/animal-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  createInsemination,
  getAnimal,
  predict,
  recommend,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  type Animal,
  type FatorPredicao,
  type PredictResponse,
  type RecomendacaoItem,
  type RecommendResponse,
  type Tecnica,
} from "@/lib/types";
import { toast } from "sonner";

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

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Matriz",
  2: "Reprodutor",
  3: "Detalhes",
};

// --------------------------- Página ----------------------------------------

export default function NovaInseminacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectMatrizId = searchParams.get("matriz_id");
  const preselectReprodutorId = searchParams.get("reprodutor_id");
  const preselectTecnica = parseTecnicaParam(searchParams.get("tecnica"));
  const preselectDataEvento = searchParams.get("data_evento");

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const useWizard = mounted && !isDesktop;

  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);

  // Estado do formulário.
  const [matriz, setMatriz] = useState<Animal | null>(null);
  const [matrizLoading, setMatrizLoading] = useState(!!preselectMatrizId);
  const [reprodutor, setReprodutor] = useState<Animal | null>(null);
  const [tecnica, setTecnica] = useState<Tecnica>(preselectTecnica ?? "IATF");
  const [dataEvento, setDataEvento] = useState<string>(() =>
    normalizeDataEventoParam(preselectDataEvento) ?? defaultDateTimeLocal(),
  );
  const [inseminador, setInseminador] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estado da predição.
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Estado da recomendação.
  const [recommendOpen, setRecommendOpen] = useState(false);

  // Pré-seleciona matriz a partir da URL.
  useEffect(() => {
    if (!preselectMatrizId) return;
    let active = true;
    setMatrizLoading(true);
    getAnimal(preselectMatrizId)
      .then((a) => {
        if (!active) return;
        if (a.sexo === "F") {
          setMatriz(a);
        } else {
          toast.error("Animal informado não é fêmea", {
            description:
              "Selecione manualmente uma matriz para registrar a inseminação.",
          });
        }
      })
      .catch(() => {
        if (active) {
          toast.error("Não encontrei essa matriz", {
            description: "Selecione manualmente uma matriz disponível.",
          });
        }
      })
      .finally(() => {
        if (active) setMatrizLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preselectMatrizId]);

  // Pré-seleciona reprodutor (via fluxo /recomendacoes → "Selecionar e registrar").
  // Depende da matriz já estar carregada para validar espécie.
  useEffect(() => {
    if (!preselectReprodutorId || !matriz) return;
    if (reprodutor && reprodutor.id === preselectReprodutorId) return;
    let active = true;
    getAnimal(preselectReprodutorId)
      .then((a) => {
        if (!active) return;
        if (a.sexo !== "M") {
          toast.error("Reprodutor inválido", {
            description: "O animal indicado na URL não é macho.",
          });
          return;
        }
        if (a.especie !== matriz.especie) {
          toast.error("Espécies incompatíveis", {
            description:
              "Reprodutor e matriz precisam ser da mesma espécie.",
          });
          return;
        }
        setReprodutor(a);
      })
      .catch(() => {
        if (active) {
          toast.error("Não encontrei esse reprodutor");
        }
      });
    return () => {
      active = false;
    };
  }, [preselectReprodutorId, matriz, reprodutor]);

  // Se o reprodutor selecionado for de espécie diferente da matriz, limpa.
  useEffect(() => {
    if (matriz && reprodutor && reprodutor.especie !== matriz.especie) {
      setReprodutor(null);
    }
  }, [matriz, reprodutor]);

  // Predição automática (debounced) — exige todos os campos chave preenchidos.
  useEffect(() => {
    if (!matriz || !reprodutor || !tecnica || !dataEvento) {
      setPrediction(null);
      setPredictionError(null);
      setPredictionLoading(false);
      return;
    }
    const dataApenas = dataEvento.slice(0, 10);
    if (dataApenas.length !== 10) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setPredictionLoading(true);
      setPredictionError(null);
      predict({
        matriz_id: matriz.id,
        reprodutor_id: reprodutor.id,
        tecnica,
        data_evento: dataApenas,
      })
        .then((res) => {
          if (active) setPrediction(res);
        })
        .catch((err: unknown) => {
          if (!active) return;
          setPrediction(null);
          setPredictionError(
            err instanceof Error ? err.message : "Erro ao prever prenhez",
          );
        })
        .finally(() => {
          if (active) setPredictionLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [matriz?.id, reprodutor?.id, tecnica, dataEvento]);

  // Validações por passo (mobile).
  const canAdvanceStep1 = !!matriz;
  const canAdvanceStep2 =
    !!reprodutor && !!matriz && reprodutor.especie === matriz.especie;
  const canSubmit =
    canAdvanceStep1 && canAdvanceStep2 && !!tecnica && !!dataEvento;

  const goNext = useCallback(() => {
    if (step === 1 && !canAdvanceStep1) {
      toast.error("Selecione a matriz antes de avançar");
      return;
    }
    if (step === 2 && !canAdvanceStep2) {
      toast.error("Selecione um reprodutor compatível");
      return;
    }
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  }, [step, canAdvanceStep1, canAdvanceStep2]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }, [step]);

  const onCancel = useCallback(() => {
    const isDirty =
      !!matriz ||
      !!reprodutor ||
      inseminador.length > 0 ||
      observacoes.length > 0;
    if (isDirty) {
      const ok = window.confirm(
        "Descartar este registro? As informações preenchidas serão perdidas.",
      );
      if (!ok) return;
    }
    router.push("/inseminacoes");
  }, [matriz, reprodutor, inseminador, observacoes, router]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit || !matriz || !reprodutor) {
      toast.error("Preencha matriz, reprodutor, técnica e data antes de salvar");
      return;
    }

    let dataIso: string;
    try {
      dataIso = new Date(dataEvento).toISOString();
    } catch {
      toast.error("Data do evento inválida");
      return;
    }

    setSubmitting(true);
    try {
      await createInsemination({
        matriz_id: matriz.id,
        reprodutor_id: reprodutor.id,
        data_evento: dataIso,
        tecnica,
        inseminador: inseminador.trim() || null,
        observacoes: observacoes.trim() || null,
        predicao_prenhez: prediction?.probabilidade_prenhez ?? null,
        modelo_versao: prediction?.modelo_versao ?? null,
        predicao_features: prediction
          ? {
              classificacao: prediction.classificacao,
              fatores_positivos: prediction.fatores_positivos,
              fatores_negativos: prediction.fatores_negativos,
              auc_referencia: prediction.auc_referencia,
            }
          : null,
      });
      toast.success("Inseminação registrada", {
        description: `${matriz.identificacao} × ${reprodutor.identificacao}.`,
      });
      router.push(`/animais/${matriz.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao salvar inseminação";
      toast.error("Não foi possível salvar", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const applyRecommendation = useCallback(
    (rec: RecomendacaoItem, modalDate: string, modalTecnica: Tecnica) => {
      // Procura o reprodutor completo via getAnimal — temos apenas o resumo.
      // Para simplificar, monta um Animal mínimo com os campos do resumo.
      const minimal: Animal = {
        id: rec.reprodutor.id,
        especie: rec.reprodutor.especie,
        identificacao: rec.reprodutor.identificacao,
        sexo: "M",
        raca: rec.reprodutor.raca,
        linhagem: rec.reprodutor.linhagem,
        origem: null,
        data_nascimento: null,
        dados_geneticos: {},
        ativo: true,
        created_at: "",
        updated_at: "",
      };
      setReprodutor(minimal);
      setTecnica(modalTecnica);
      // Mantém o horário atual; substitui apenas a data.
      const hora = dataEvento.length >= 16 ? dataEvento.slice(11, 16) : "09:00";
      setDataEvento(`${modalDate}T${hora}`);
      setRecommendOpen(false);
      if (useWizard) setStep(3);
    },
    [dataEvento, useWizard],
  );

  // --------------------------- Render -----------------------------------

  const matrizSection = (
    <MatrizSection
      matriz={matriz}
      matrizLoading={matrizLoading}
      onChange={(a) => {
        setMatriz(a);
        if (!a) setReprodutor(null);
      }}
    />
  );
  const reprodutorSection = (
    <ReprodutorSection
      matriz={matriz}
      reprodutor={reprodutor}
      onChange={setReprodutor}
      onOpenRecommend={() => {
        if (!matriz) {
          toast.error("Selecione a matriz antes de recomendar");
          return;
        }
        setRecommendOpen(true);
      }}
    />
  );
  const detalhesSection = (
    <DetalhesSection
      tecnica={tecnica}
      onTecnicaChange={setTecnica}
      dataEvento={dataEvento}
      onDataEventoChange={setDataEvento}
      inseminador={inseminador}
      onInseminadorChange={setInseminador}
      observacoes={observacoes}
      onObservacoesChange={setObservacoes}
    />
  );
  const predictionPanel = (
    <PredictionPanel
      hasInputs={!!matriz && !!reprodutor && !!tecnica && !!dataEvento}
      loading={predictionLoading}
      error={predictionError}
      data={prediction}
    />
  );

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-5 pb-32 lg:pb-0">
          {/* Cabeçalho */}
          <header className="flex flex-col gap-2">
            <Link
              href="/inseminacoes"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Voltar para inseminações
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Registrar inseminação
            </h1>
            <p className="text-sm text-muted-foreground">
              Cruzamento com predição da IA e explicabilidade dos fatores.
            </p>
          </header>

          {useWizard ? <StepIndicator step={step} /> : null}

          {useWizard ? (
            <>
              {step === 1 ? matrizSection : null}
              {step === 2 ? reprodutorSection : null}
              {step === 3 ? (
                <>
                  {detalhesSection}
                  {predictionPanel}
                </>
              ) : null}
            </>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="flex flex-col gap-5 lg:col-span-2">
                {matrizSection}
                {reprodutorSection}
                {detalhesSection}
              </div>
              <aside className="lg:col-span-1">
                <div className="lg:sticky lg:top-20">{predictionPanel}</div>
              </aside>
            </div>
          )}
        </div>

        <ActionBar
          useWizard={useWizard}
          step={step}
          submitting={submitting}
          canSubmit={canSubmit}
          onCancel={onCancel}
          onNext={goNext}
          onBack={goBack}
        />
      </form>

      <RecommendDialog
        open={recommendOpen}
        onOpenChange={setRecommendOpen}
        matriz={matriz}
        initialDate={dataEvento.slice(0, 10) || todayISODate()}
        initialTecnica={tecnica}
        onSelect={applyRecommendation}
      />
    </>
  );
}

// --------------------------- Indicador de passos ---------------------------

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <ol
      aria-label="Progresso do cadastro"
      className="flex items-center gap-2"
    >
      {[1, 2, 3].map((n) => {
        const active = step === n;
        const done = step > n;
        return (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                done && "bg-primary text-primary-foreground",
                active && "border-2 border-primary text-primary",
                !active && !done && "border border-border text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3 w-3" aria-hidden /> : n}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {STEP_LABELS[n as WizardStep]}
            </span>
            {n < 3 ? (
              <span
                className={cn(
                  "ml-1 h-px flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// --------------------------- Seções ----------------------------------------

function MatrizSection({
  matriz,
  matrizLoading,
  onChange,
}: {
  matriz: Animal | null;
  matrizLoading: boolean;
  onChange: (a: Animal | null) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>🐄</span>
          Matriz
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Selecione a fêmea que receberá a inseminação.
        </p>
      </CardHeader>
      <CardContent>
        {matrizLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <AnimalSearchInput
            sexo="F"
            value={matriz}
            onChange={onChange}
            placeholder="Buscar matriz por identificação…"
            inputId="matriz-input"
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReprodutorSection({
  matriz,
  reprodutor,
  onChange,
  onOpenRecommend,
}: {
  matriz: Animal | null;
  reprodutor: Animal | null;
  onChange: (a: Animal | null) => void;
  onOpenRecommend: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span aria-hidden>🐂</span>
              Reprodutor
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {matriz
                ? `Apenas machos de ${ESPECIE_LABEL[matriz.especie].toLowerCase()}.`
                : "Selecione a matriz primeiro para ver reprodutores compatíveis."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenRecommend}
            disabled={!matriz}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Recomendar com IA
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <AnimalSearchInput
          sexo="M"
          especie={matriz?.especie}
          value={reprodutor}
          onChange={onChange}
          placeholder="Buscar reprodutor por identificação…"
          disabled={!matriz}
          inputId="reprodutor-input"
        />
        {matriz && reprodutor && reprodutor.especie !== matriz.especie ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Matriz e reprodutor devem ser da mesma espécie.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetalhesSection({
  tecnica,
  onTecnicaChange,
  dataEvento,
  onDataEventoChange,
  inseminador,
  onInseminadorChange,
  observacoes,
  onObservacoesChange,
}: {
  tecnica: Tecnica;
  onTecnicaChange: (t: Tecnica) => void;
  dataEvento: string;
  onDataEventoChange: (v: string) => void;
  inseminador: string;
  onInseminadorChange: (v: string) => void;
  observacoes: string;
  onObservacoesChange: (v: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden>📝</span>
          Detalhes do evento
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tecnica">Técnica *</Label>
          <Select
            value={tecnica}
            onValueChange={(v) => onTecnicaChange(v as Tecnica)}
          >
            <SelectTrigger id="tecnica">
              <SelectValue placeholder="Selecione a técnica" />
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
          <Label htmlFor="data_evento">Data e hora *</Label>
          <Input
            id="data_evento"
            type="datetime-local"
            value={dataEvento}
            onChange={(e) => onDataEventoChange(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="inseminador">Inseminador (opcional)</Label>
          <Input
            id="inseminador"
            value={inseminador}
            onChange={(e) => onInseminadorChange(e.target.value)}
            placeholder="Quem realizou o procedimento"
            maxLength={160}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="observacoes">Observações (opcional)</Label>
          <textarea
            id="observacoes"
            value={observacoes}
            onChange={(e) => onObservacoesChange(e.target.value)}
            rows={3}
            placeholder="Anotações sobre o procedimento, condições do animal, etc."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --------------------------- Painel de predição ----------------------------

function PredictionPanel({
  hasInputs,
  loading,
  error,
  data,
}: {
  hasInputs: boolean;
  loading: boolean;
  error: string | null;
  data: PredictResponse | null;
}) {
  if (!hasInputs) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" aria-hidden />
            Predição da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Preencha matriz, reprodutor, técnica e data para ver a predição.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" aria-hidden />
            Predição da IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" aria-hidden />
            Predição da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const pct = Math.round(data.probabilidade_prenhez * 100);
  const tone = predictionTone(pct);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" aria-hidden />
          Predição da IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {pct}%
            </span>
            <Badge variant={tone.badge}>
              {CLASSIFICACAO_LABEL[data.classificacao] ?? data.classificacao}
            </Badge>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-muted"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <FactorsList
            title="Favorecem o sucesso"
            icon="up"
            items={data.fatores_positivos.slice(0, 4)}
          />
          <FactorsList
            title="Pesam contra"
            icon="down"
            items={data.fatores_negativos.slice(0, 4)}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Modelo {data.modelo_versao} · AUC ROC {data.auc_referencia.toFixed(2)}
        </p>
      </CardContent>
    </Card>
  );
}

function FactorsList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: "up" | "down";
  items: FatorPredicao[];
}) {
  const Icon = icon === "up" ? TrendingUp : TrendingDown;
  const colorClass = icon === "up" ? "text-success" : "text-destructive";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", colorClass)} aria-hidden />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum fator destacado.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((f, idx) => (
            <li
              key={`${f.feature}-${idx}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">{f.feature}</span>
              <span
                className={cn("text-xs font-semibold tabular-nums", colorClass)}
              >
                {f.impacto_relativo >= 0 ? "+" : ""}
                {f.impacto_relativo.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function predictionTone(pct: number): {
  bar: string;
  badge: "success" | "warning" | "destructive";
} {
  if (pct >= 70) return { bar: "bg-success", badge: "success" };
  if (pct >= 45) return { bar: "bg-warning", badge: "warning" };
  return { bar: "bg-destructive", badge: "destructive" };
}

// --------------------------- Diálogo de recomendação -----------------------

function RecommendDialog({
  open,
  onOpenChange,
  matriz,
  initialDate,
  initialTecnica,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matriz: Animal | null;
  initialDate: string;
  initialTecnica: Tecnica;
  onSelect: (rec: RecomendacaoItem, date: string, tecnica: Tecnica) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [tecnica, setTecnica] = useState<Tecnica>(initialTecnica);
  const [filtrarParentesco, setFiltrarParentesco] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<RecommendResponse | null>(null);
  const lastQueryRef = useRef<string>("");

  // Reseta ao abrir.
  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setTecnica(initialTecnica);
    setResponse(null);
    setError(null);
    lastQueryRef.current = "";
  }, [open, initialDate, initialTecnica]);

  const handleFetch = useCallback(async () => {
    if (!matriz) return;
    const key = `${matriz.id}|${date}|${tecnica}|${filtrarParentesco}`;
    if (key === lastQueryRef.current && response) return;
    lastQueryRef.current = key;
    setLoading(true);
    setError(null);
    try {
      const res = await recommend({
        matriz_id: matriz.id,
        data_evento: date,
        tecnica,
        top_n: 5,
        filtrar_parentesco: filtrarParentesco,
      });
      setResponse(res);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar recomendações";
      setError(message);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [matriz, date, tecnica, filtrarParentesco, response]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Recomendar reprodutor com IA
          </DialogTitle>
          <DialogDescription>
            {matriz ? (
              <>
                Top 5 reprodutores para{" "}
                <strong>{matriz.identificacao}</strong> (
                {ESPECIE_LABEL[matriz.especie]}).
              </>
            ) : (
              "Selecione a matriz para começar."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rec-date">Data prevista</Label>
            <Input
              id="rec-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
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
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleFetch}
              disabled={loading || !matriz}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Buscando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Buscar
                </>
              )}
            </Button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={filtrarParentesco}
            onChange={(e) => setFiltrarParentesco(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          Filtrar reprodutores com possível parentesco
        </label>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!response && !loading && !error ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Clique em <strong>Buscar</strong> para rodar a IA com a data e a
            técnica acima.
          </div>
        ) : null}

        {response ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                Avaliados: {response.total_reprodutores_avaliados}
              </span>
              {response.total_filtrados_por_parentesco > 0 ? (
                <span>
                  · Filtrados por parentesco:{" "}
                  {response.total_filtrados_por_parentesco}
                </span>
              ) : null}
              <span>
                · Modelo {response.modelo_versao} · AUC{" "}
                {response.auc_referencia.toFixed(2)}
              </span>
            </div>

            {response.recomendacoes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Nenhum reprodutor compatível encontrado com esses critérios.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {response.recomendacoes.map((rec) => (
                  <RecommendItem
                    key={rec.reprodutor.id}
                    rec={rec}
                    onSelect={() => onSelect(rec, date, tecnica)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RecommendItem({
  rec,
  onSelect,
}: {
  rec: RecomendacaoItem;
  onSelect: () => void;
}) {
  const pct = Math.round(rec.probabilidade_prenhez * 100);
  const tone = predictionTone(pct);
  return (
    <li>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            #{rec.rank}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {rec.reprodutor.identificacao}
            </span>
            <span className="text-xs text-muted-foreground">
              {rec.reprodutor.raca ?? "Raça não informada"}
              {rec.reprodutor.linhagem ? ` · ${rec.reprodutor.linhagem}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-semibold tabular-nums">{pct}%</span>
            <Badge variant={tone.badge}>
              {CLASSIFICACAO_LABEL[rec.classificacao] ?? rec.classificacao}
            </Badge>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full", tone.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          {rec.fatores_positivos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] text-muted-foreground">
              {rec.fatores_positivos.slice(0, 2).map((f, i) => (
                <span
                  key={`${f.feature}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-success"
                >
                  <TrendingUp className="h-3 w-3" aria-hidden />
                  {f.feature}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={onSelect}
          size="sm"
          className="self-stretch sm:self-center"
        >
          Selecionar
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

// --------------------------- Barra de ações --------------------------------

function ActionBar({
  useWizard,
  step,
  submitting,
  canSubmit,
  onCancel,
  onNext,
  onBack,
}: {
  useWizard: boolean;
  step: WizardStep;
  submitting: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  if (useWizard) {
    const isLast = step === 3;
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background",
          "px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={submitting}
              className="min-w-[6rem]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
              className="min-w-[6rem]"
            >
              Cancelar
            </Button>
          )}
          {isLast ? (
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="min-w-[8rem]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Confirmar
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onNext}
              disabled={submitting}
              className="min-w-[8rem]"
            >
              Próximo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-6 flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={submitting}
      >
        Cancelar
      </Button>
      <Button type="submit" disabled={!canSubmit || submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          <>
            <Check className="h-4 w-4" aria-hidden />
            Confirmar inseminação
          </>
        )}
      </Button>
    </div>
  );
}

// --------------------------- Utilidades ------------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function defaultDateTimeLocal(): string {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return `${date}T${time}`;
}

function todayISODate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

const TECNICAS_VALIDAS: ReadonlyArray<Tecnica> = [
  "IATF",
  "convencional",
  "IA_repasse",
  "IA_cervical",
  "IA_laparoscopica",
];

function parseTecnicaParam(v: string | null): Tecnica | null {
  if (!v) return null;
  return TECNICAS_VALIDAS.includes(v as Tecnica) ? (v as Tecnica) : null;
}

/** Aceita "YYYY-MM-DD" (preenche T09:00) ou "YYYY-MM-DDTHH:MM"; rejeita o resto. */
function normalizeDataEventoParam(v: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T09:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16);
  return null;
}

// Garante que essa rota não tenta SSR/static-prerender (usa useSearchParams).
export const dynamic = "force-dynamic";
