"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Beef,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Dna,
  Loader2,
  Mars,
  Pencil,
  Plus,
  Sparkles,
  Syringe,
  Venus,
} from "lucide-react";

import { UpdateDiagnosticoDialog } from "@/components/update-diagnostico-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, getAnimal, listInseminations } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  RESULTADO_LABEL,
  type Animal,
  type Inseminacao,
  type ResultadoDiagnostico,
  type Sexo,
} from "@/lib/types";

const STATUS_VARIANT: Record<
  ResultadoDiagnostico,
  "success" | "warning" | "destructive"
> = {
  prenhe: "success",
  aguardando: "warning",
  vazia: "destructive",
};

// Rótulos amigáveis para chaves de dados_geneticos (espelha DadosGeneticos
// Femea/Macho do backend). Chaves desconhecidas caem no fallback bruto.
const GENETIC_LABEL: Record<string, string> = {
  ecc: "ECC (condição corporal)",
  paridade: "Paridade (partos)",
  idade_anos: "Idade",
  historico_sucesso: "Histórico de sucesso da matriz",
  taxa_sucesso_historica: "Taxa de sucesso do reprodutor",
};

const ESPECIE_EMOJI: Record<string, string> = {
  bovino: "🐄",
  ovino: "🐑",
  caprino: "🐐",
};

export default function AnimalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [animalError, setAnimalError] = useState<string | null>(null);
  const [animalLoading, setAnimalLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [inseminacoes, setInseminacoes] = useState<Inseminacao[]>([]);
  const [insemLoading, setInsemLoading] = useState(false);
  const [insemError, setInsemError] = useState<string | null>(null);

  // Busca o animal.
  useEffect(() => {
    let active = true;
    setAnimalLoading(true);
    setAnimalError(null);
    setNotFound(false);
    getAnimal(id)
      .then((a) => {
        if (active) setAnimal(a);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setAnimalError(
            err instanceof Error ? err.message : "Erro ao buscar animal",
          );
        }
      })
      .finally(() => {
        if (active) setAnimalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Busca inseminações apenas para fêmeas.
  useEffect(() => {
    if (!animal || animal.sexo !== "F") return;
    let active = true;
    setInsemLoading(true);
    setInsemError(null);
    listInseminations({
      matriz_id: animal.id,
      page: 1,
      page_size: 50,
    })
      .then((res) => {
        if (active) setInseminacoes(res.items);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setInsemError(
          err instanceof Error
            ? err.message
            : "Não foi possível buscar inseminações",
        );
      })
      .finally(() => {
        if (active) setInsemLoading(false);
      });
    return () => {
      active = false;
    };
  }, [animal]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
        <AlertTriangle
          className="h-10 w-10 text-muted-foreground"
          aria-hidden
        />
        <h1 className="text-base font-semibold">Animal não encontrado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Esse animal pode ter sido removido ou pertencer a outro produtor.
        </p>
        <Button asChild>
          <Link href="/animais">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar para animais
          </Link>
        </Button>
      </div>
    );
  }

  if (animalError) {
    return (
      <ErrorCard
        title="Não foi possível carregar este animal"
        message={animalError}
        retry={() => router.refresh()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 sm:pb-0">
      <Link
        href="/animais"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden />
        Voltar para animais
      </Link>

      {animalLoading || !animal ? (
        <AnimalHeaderSkeleton />
      ) : (
        <AnimalHeader animal={animal} />
      )}

      {animalLoading || !animal ? (
        <Skeleton className="h-44 w-full rounded-lg" />
      ) : (
        <GeneticSection animal={animal} />
      )}

      {animal && animal.sexo === "F" ? (
        <InseminacoesSection
          loading={insemLoading}
          error={insemError}
          items={inseminacoes}
          onItemUpdated={(updated) =>
            setInseminacoes((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i)),
            )
          }
        />
      ) : null}

      {/* Ação primária — inline desktop, fixa no rodapé mobile */}
      {animal ? <PrimaryAction animal={animal} /> : null}
    </div>
  );
}

// --------------------------- Header -----------------------------------------

function AnimalHeader({ animal }: { animal: Animal }) {
  const initials = animal.identificacao.slice(0, 2).toUpperCase();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        {/* Foto placeholder */}
        <div
          aria-hidden
          className="grid h-24 w-24 shrink-0 place-items-center self-start rounded-lg bg-primary/10 text-3xl font-semibold text-primary sm:h-28 sm:w-28"
        >
          {initials}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {animal.identificacao}
            </h1>
            {!animal.ativo ? (
              <Badge variant="muted">Inativo</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>{ESPECIE_EMOJI[animal.especie] ?? ""}</span>
              {ESPECIE_LABEL[animal.especie]}
            </span>
            <span aria-hidden>·</span>
            <SexoBadge sexo={animal.sexo} />
            {animal.raca ? (
              <>
                <span aria-hidden>·</span>
                <span>{animal.raca}</span>
              </>
            ) : null}
          </div>
          {(animal.linhagem || animal.origem) ? (
            <div className="text-xs text-muted-foreground">
              {animal.linhagem ? <>Linhagem: {animal.linhagem}</> : null}
              {animal.linhagem && animal.origem ? " · " : null}
              {animal.origem ? <>Origem: {animal.origem}</> : null}
            </div>
          ) : null}
          {animal.data_nascimento ? (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" aria-hidden />
              Nascido em{" "}
              {new Date(animal.data_nascimento).toLocaleDateString("pt-BR")}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AnimalHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <Skeleton className="h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-52" />
        </div>
      </CardContent>
    </Card>
  );
}

function SexoBadge({ sexo }: { sexo: Sexo }) {
  if (sexo === "F") {
    return (
      <Badge variant="muted" className="gap-1">
        <Venus className="h-3 w-3" aria-hidden />
        Fêmea
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="gap-1">
      <Mars className="h-3 w-3" aria-hidden />
      Macho
    </Badge>
  );
}

// --------------------------- Dados genéticos --------------------------------

function GeneticSection({ animal }: { animal: Animal }) {
  const entries = useMemo(() => {
    return Object.entries(animal.dados_geneticos ?? {});
  }, [animal.dados_geneticos]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Dna className="h-5 w-5 text-primary" aria-hidden />
          Dados genéticos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado genético cadastrado para este animal.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {entries.map(([key, raw]) => (
              <div key={key} className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {GENETIC_LABEL[key] ?? key}
                </dt>
                <dd className="text-base font-medium text-foreground">
                  {formatGeneticValue(key, raw)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function formatGeneticValue(key: string, raw: unknown): string {
  if (typeof raw !== "number") {
    return raw === null || raw === undefined ? "—" : String(raw);
  }
  switch (key) {
    case "ecc":
      return raw.toFixed(1);
    case "idade_anos": {
      const years = Math.floor(raw);
      const months = Math.round((raw - years) * 12);
      if (years === 0) return `${months}m`;
      if (months === 0) return `${years} anos`;
      return `${years}a ${months}m`;
    }
    case "historico_sucesso":
    case "taxa_sucesso_historica":
      return `${Math.round(raw * 100)}%`;
    case "paridade":
      return String(Math.round(raw));
    default:
      return Number.isInteger(raw) ? String(raw) : raw.toFixed(2);
  }
}

// --------------------------- Inseminações ----------------------------------

function InseminacoesSection({
  loading,
  error,
  items,
  onItemUpdated,
}: {
  loading: boolean;
  error: string | null;
  items: Inseminacao[];
  onItemUpdated: (updated: Inseminacao) => void;
}) {
  const [editing, setEditing] = useState<Inseminacao | null>(null);

  const counts = useMemo(() => {
    let prenhe = 0;
    let vazia = 0;
    let aguardando = 0;
    for (const i of items) {
      if (i.resultado_diagnostico === "prenhe") prenhe++;
      else if (i.resultado_diagnostico === "vazia") vazia++;
      else aguardando++;
    }
    return { prenhe, vazia, aguardando, total: items.length };
  }, [items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <Syringe className="h-5 w-5 text-primary" aria-hidden />
          Inseminações
        </CardTitle>
        {!loading && items.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {counts.total} no histórico
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando inseminações…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta matriz ainda não tem inseminações registradas.
          </p>
        ) : (
          <>
            {/* Resumo */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="success">{counts.prenhe} prenhes</Badge>
              <Badge variant="warning">{counts.aguardando} aguardando</Badge>
              <Badge variant="destructive">{counts.vazia} vazias</Badge>
            </div>

            {/* Mobile: cards */}
            <ul className="flex flex-col gap-2 sm:hidden">
              {items.map((i) => {
                const aguardando = i.resultado_diagnostico === "aguardando";
                return (
                  <li
                    key={i.id}
                    className="flex flex-col gap-2 rounded-md border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {formatDateTime(i.data_evento)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {i.tecnica}
                          {i.predicao_prenhez !== null
                            ? ` · IA: ${(i.predicao_prenhez * 100).toFixed(0)}%`
                            : ""}
                        </span>
                      </div>
                      <Badge variant={STATUS_VARIANT[i.resultado_diagnostico]}>
                        {RESULTADO_LABEL[i.resultado_diagnostico]}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={aguardando ? "default" : "outline"}
                      onClick={() => setEditing(i)}
                      className="self-stretch"
                    >
                      {aguardando ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                          Confirmar resultado
                        </>
                      ) : (
                        <>
                          <Pencil className="h-4 w-4" aria-hidden />
                          Editar resultado
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: tabela densa */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Técnica</TableHead>
                    <TableHead>Predição IA</TableHead>
                    <TableHead>Inseminador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => {
                    const aguardando = i.resultado_diagnostico === "aguardando";
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          {formatDateTime(i.data_evento)}
                        </TableCell>
                        <TableCell>{i.tecnica}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {i.predicao_prenhez !== null
                            ? `${(i.predicao_prenhez * 100).toFixed(0)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {i.inseminador ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANT[i.resultado_diagnostico]}
                          >
                            {RESULTADO_LABEL[i.resultado_diagnostico]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={aguardando ? "default" : "ghost"}
                            onClick={() => setEditing(i)}
                          >
                            {aguardando ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                                Confirmar
                              </>
                            ) : (
                              <>
                                <Pencil className="h-4 w-4" aria-hidden />
                                Editar
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>

      <UpdateDiagnosticoDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        inseminacao={editing}
        onSaved={onItemUpdated}
      />
    </Card>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// --------------------------- Ação primária ---------------------------------

function PrimaryAction({ animal }: { animal: Animal }) {
  if (animal.sexo === "F") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
          "sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0",
          "sm:flex sm:justify-end",
        )}
      >
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/inseminacoes/nova?matriz_id=${animal.id}`}>
            <Plus className="h-4 w-4" aria-hidden />
            Registrar inseminação
          </Link>
        </Button>
      </div>
    );
  }
  // Macho: botão visível mas inativo (rota futura).
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        "sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0",
        "sm:flex sm:justify-end",
      )}
    >
      <Button
        type="button"
        variant="outline"
        disabled
        title="Em breve"
        className="w-full sm:w-auto"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Ver recomendações como reprodutor
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}

// --------------------------- Erro -------------------------------------------

function ErrorCard({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" aria-hidden />
        <strong className="font-semibold">{title}</strong>
      </div>
      <span>{message}</span>
      {retry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={retry}
          className="mt-1"
        >
          <Beef className="h-3 w-3" aria-hidden />
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
