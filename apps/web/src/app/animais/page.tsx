"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Beef,
  Eye,
  Mars,
  PawPrint,
  Plus,
  Search,
  Venus,
  type LucideIcon,
} from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getStats, listAnimals, listInseminations } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  type Animal,
  type Especie,
  type EstatisticaEspecie,
  type Inseminacao,
  type ResultadoDiagnostico,
  type Sexo,
} from "@/lib/types";

// --------------------------- Configuração das chips ------------------------

interface EspecieChip {
  value: Especie | "todos";
  label: string;
  emoji: string;
}

const ESPECIE_CHIPS: EspecieChip[] = [
  { value: "todos", label: "Todos", emoji: "🌾" },
  { value: "bovino", label: "Bovinos", emoji: "🐄" },
  { value: "ovino", label: "Ovinos", emoji: "🐑" },
  { value: "caprino", label: "Caprinos", emoji: "🐐" },
];

interface SexoChip {
  value: Sexo | "todos";
  label: string;
}

const SEXO_CHIPS: SexoChip[] = [
  { value: "todos", label: "Todos" },
  { value: "F", label: "Fêmeas" },
  { value: "M", label: "Machos" },
];

const STATUS_VARIANT: Record<
  ResultadoDiagnostico,
  "success" | "warning" | "destructive"
> = {
  prenhe: "success",
  aguardando: "warning",
  vazia: "destructive",
};

const STATUS_LABEL: Record<ResultadoDiagnostico, string> = {
  prenhe: "Prenhe",
  aguardando: "Aguardando",
  vazia: "Vazia",
};

// --------------------------- Página ----------------------------------------

export default function AnimaisPage() {
  // Detecta desktop só depois do mount (evita flicker de fetch com pageSize errado).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const pageSize = isDesktop ? 50 : 20;

  // Filtros e busca.
  const [especie, setEspecie] = useState<Especie | "todos">("todos");
  const [sexo, setSexo] = useState<Sexo | "todos">("todos");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [page, setPage] = useState(1);

  // Estado da listagem.
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contagens por espécie (chips). Vem do /stats.
  const [counts, setCounts] = useState<Record<Especie, number> | null>(null);
  const [totalGeral, setTotalGeral] = useState<number | null>(null);

  // Última inseminação por matriz (status na coluna correspondente).
  const [latestByMatriz, setLatestByMatriz] = useState<
    Record<string, Inseminacao | null>
  >({});

  // Reset de página quando filtros mudam.
  useEffect(() => {
    setPage(1);
  }, [especie, sexo, debouncedQuery, pageSize]);

  // Busca contagens uma vez no mount.
  useEffect(() => {
    let active = true;
    getStats()
      .then((data) => {
        if (!active) return;
        const next: Record<Especie, number> = {
          bovino: 0,
          ovino: 0,
          caprino: 0,
        };
        data.por_especie.forEach((item: EstatisticaEspecie) => {
          next[item.especie] = item.total_animais;
        });
        setCounts(next);
        setTotalGeral(data.total_animais);
      })
      .catch(() => {
        // Falha aqui é não-fatal — chips funcionam sem contagens.
        if (active) {
          setCounts({ bovino: 0, ovino: 0, caprino: 0 });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Busca a página de animais sempre que filtros, busca ou paginação mudam.
  useEffect(() => {
    if (!mounted) return;

    let active = true;
    setLoading(true);
    setError(null);

    listAnimals({
      especie: especie === "todos" ? undefined : especie,
      sexo: sexo === "todos" ? undefined : sexo,
      busca: debouncedQuery.trim() || undefined,
      page,
      page_size: pageSize,
      ativo: true,
    })
      .then((res) => {
        if (!active) return;
        setAnimals(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao buscar animais");
        setAnimals([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mounted, especie, sexo, debouncedQuery, page, pageSize]);

  // Para cada fêmea da página, busca a inseminação mais recente.
  useEffect(() => {
    if (animals.length === 0) {
      setLatestByMatriz({});
      return;
    }
    const matrizes = animals.filter((a) => a.sexo === "F");
    if (matrizes.length === 0) {
      setLatestByMatriz({});
      return;
    }

    let active = true;
    Promise.all(
      matrizes.map((m) =>
        listInseminations({ matriz_id: m.id, page: 1, page_size: 1 })
          .then((res) => [m.id, res.items[0] ?? null] as const)
          .catch(() => [m.id, null] as const),
      ),
    ).then((entries) => {
      if (!active) return;
      const next: Record<string, Inseminacao | null> = {};
      for (const [id, ins] of entries) next[id] = ins;
      setLatestByMatriz(next);
    });

    return () => {
      active = false;
    };
  }, [animals]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / pageSize) : 1),
    [total, pageSize],
  );

  // Faixa visível, e.g. "Mostrando 1–20 de 990".
  const visibleRange = useMemo(() => {
    if (total === 0) return null;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return { start, end };
  }, [page, pageSize, total]);

  const handleEspecieClick = useCallback((value: Especie | "todos") => {
    setEspecie(value);
  }, []);
  const handleSexoClick = useCallback((value: Sexo | "todos") => {
    setSexo(value);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Animais
          </h1>
          <p className="text-sm text-muted-foreground">
            Matrizes e reprodutores cadastrados no rebanho.
            {totalGeral !== null ? (
              <span> {formatInt(totalGeral)} no total.</span>
            ) : null}
          </p>
        </div>
        {/* Botão "Novo animal" — desktop apenas. Mobile usa FAB. */}
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/animais/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo animal
          </Link>
        </Button>
      </header>

      {/* Filtros */}
      <section
        aria-label="Filtros"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:gap-4 sm:p-4"
      >
        <ChipGroup
          ariaLabel="Filtrar por espécie"
          options={ESPECIE_CHIPS.map((chip) => ({
            value: chip.value,
            label: chip.label,
            prefix: chip.emoji,
            count:
              chip.value === "todos"
                ? totalGeral ?? undefined
                : counts?.[chip.value],
          }))}
          selected={especie}
          onSelect={handleEspecieClick}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ChipGroup
            ariaLabel="Filtrar por sexo"
            options={SEXO_CHIPS.map((chip) => ({
              value: chip.value,
              label: chip.label,
              icon:
                chip.value === "F"
                  ? Venus
                  : chip.value === "M"
                    ? Mars
                    : undefined,
            }))}
            selected={sexo}
            onSelect={handleSexoClick}
          />
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Buscar por identificação…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Buscar por identificação"
            />
          </div>
        </div>
      </section>

      {/* Resumo da faixa atual */}
      {!loading && !error && total > 0 && visibleRange ? (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Mostrando {formatInt(visibleRange.start)}–
          {formatInt(visibleRange.end)} de {formatInt(total)}.
        </p>
      ) : null}

      {/* Conteúdo principal */}
      {error ? <ErrorState message={error} /> : null}

      {loading ? (
        <ListSkeleton isDesktop={isDesktop} pageSize={pageSize} />
      ) : null}

      {!loading && !error && animals.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters(especie, sexo, debouncedQuery)} />
      ) : null}

      {!loading && !error && animals.length > 0 ? (
        <>
          {/* Mobile: cards empilhados */}
          <div className="flex flex-col gap-3 sm:hidden">
            {animals.map((a) => (
              <AnimalCard
                key={a.id}
                animal={a}
                lastInsemination={latestByMatriz[a.id]}
              />
            ))}
          </div>

          {/* Tablet: grid de 2 colunas */}
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:hidden">
            {animals.map((a) => (
              <AnimalCard
                key={a.id}
                animal={a}
                lastInsemination={latestByMatriz[a.id]}
              />
            ))}
          </div>

          {/* Desktop: tabela densa */}
          <div className="hidden rounded-lg border border-border bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Espécie</TableHead>
                  <TableHead>Raça</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Idade</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      ECC
                      <InfoHint label="Escore de Condição Corporal: avaliação visual da condição da matriz na escala 1 (magra) a 5 (obesa). Ideal entre 3,0 e 3,5." />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Última IA
                      <InfoHint label="Data da última Inseminação Artificial registrada para a matriz." />
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {animals.map((a) => (
                  <AnimalRow
                    key={a.id}
                    animal={a}
                    lastInsemination={latestByMatriz[a.id]}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      ) : null}

      {/* FAB mobile */}
      <Link
        href="/animais/novo"
        aria-label="Novo animal"
        className={cn(
          "fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg",
          "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "sm:hidden",
        )}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </Link>
    </div>
  );
}

// --------------------------- Chips ------------------------------------------

interface ChipOption<V extends string> {
  value: V;
  label: string;
  prefix?: string;
  icon?: LucideIcon;
  count?: number;
}

function ChipGroup<V extends string>({
  ariaLabel,
  options,
  selected,
  onSelect,
}: {
  ariaLabel: string;
  options: ChipOption<V>[];
  selected: V;
  onSelect: (value: V) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === selected;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "sm:min-h-9",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-muted",
            )}
          >
            {opt.prefix ? <span aria-hidden>{opt.prefix}</span> : null}
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
            <span>{opt.label}</span>
            {opt.count !== undefined ? (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {formatInt(opt.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// --------------------------- Card (mobile + tablet) -------------------------

function AnimalCard({
  animal,
  lastInsemination,
}: {
  animal: Animal;
  lastInsemination: Inseminacao | null | undefined;
}) {
  // Card inteiro é clicável (vai pra ficha do animal). O ícone de olho no
  // canto inferior direito reforça visualmente que existe ação de "ver mais".
  return (
    <Link
      href={`/animais/${animal.id}`}
      aria-label={`Ver detalhes de ${animal.identificacao}`}
      className="block rounded-lg transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="relative">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Beef className="h-4 w-4 text-primary" aria-hidden />
              {animal.identificacao}
            </CardTitle>
            <SexoBadge sexo={animal.sexo} />
          </div>
          <p className="text-xs text-muted-foreground">
            {ESPECIE_LABEL[animal.especie]}
            {animal.raca ? ` · ${animal.raca}` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Idade" value={formatIdade(animal)} />
            <Field label="ECC" value={formatEcc(animal)} />
            <div className="col-span-2 flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  sexo={animal.sexo}
                  lastInsemination={lastInsemination}
                />
                {lastInsemination ? (
                  <span className="text-xs text-muted-foreground">
                    Última IA em {formatDate(lastInsemination.data_evento)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        </CardContent>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-md bg-muted text-muted-foreground sm:bottom-4 sm:right-4"
        >
          <Eye className="h-4 w-4" />
        </span>
      </Card>
    </Link>
  );
}

// --------------------------- Row (desktop table) ---------------------------

function AnimalRow({
  animal,
  lastInsemination,
}: {
  animal: Animal;
  lastInsemination: Inseminacao | null | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{animal.identificacao}</TableCell>
      <TableCell>{ESPECIE_LABEL[animal.especie]}</TableCell>
      <TableCell className="text-muted-foreground">
        {animal.raca ?? "—"}
      </TableCell>
      <TableCell>
        <SexoBadge sexo={animal.sexo} />
      </TableCell>
      <TableCell>{formatIdade(animal)}</TableCell>
      <TableCell>{formatEcc(animal)}</TableCell>
      <TableCell className="text-muted-foreground">
        {lastInsemination ? formatDate(lastInsemination.data_evento) : "—"}
      </TableCell>
      <TableCell>
        <StatusBadge
          sexo={animal.sexo}
          lastInsemination={lastInsemination}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/animais/${animal.id}`}>
            <Eye className="h-4 w-4" aria-hidden />
            Detalhes
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// --------------------------- Subcomponentes auxiliares ---------------------

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

function StatusBadge({
  sexo,
  lastInsemination,
}: {
  sexo: Sexo;
  lastInsemination: Inseminacao | null | undefined;
}) {
  if (sexo === "M") {
    return <span className="text-xs text-muted-foreground">Reprodutor</span>;
  }
  if (lastInsemination === undefined) {
    return <Skeleton className="h-5 w-20" />;
  }
  if (lastInsemination === null) {
    return <Badge variant="muted">Sem IA</Badge>;
  }
  const result = lastInsemination.resultado_diagnostico;
  return (
    <Badge variant={STATUS_VARIANT[result]}>{STATUS_LABEL[result]}</Badge>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="min-h-11 sm:min-h-9"
      >
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground sm:text-sm">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="min-h-11 sm:min-h-9"
      >
        Próxima
      </Button>
    </div>
  );
}

function ListSkeleton({
  isDesktop,
  pageSize,
}: {
  isDesktop: boolean;
  pageSize: number;
}) {
  const rows = Math.min(pageSize, isDesktop ? 8 : 5);
  if (isDesktop) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b px-3 py-2">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-9 items-center gap-3 border-b px-3 py-3 last:border-0"
          >
            <Skeleton className="col-span-1 h-4 w-20" />
            <Skeleton className="col-span-1 h-4 w-16" />
            <Skeleton className="col-span-1 h-4 w-24" />
            <Skeleton className="col-span-1 h-4 w-14" />
            <Skeleton className="col-span-1 h-4 w-12" />
            <Skeleton className="col-span-1 h-4 w-10" />
            <Skeleton className="col-span-1 h-4 w-20" />
            <Skeleton className="col-span-1 h-5 w-16 rounded-full" />
            <Skeleton className="col-span-1 ml-auto h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-1 h-3 w-40" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="col-span-2 h-8 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
      <PawPrint className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">
        {hasFilters ? "Nenhum animal encontrado" : "Nenhum animal cadastrado"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Tente limpar os filtros ou ajustar a busca para ver mais resultados."
          : "Cadastre o primeiro animal para começar a registrar inseminações."}
      </p>
      {!hasFilters ? (
        <Button asChild className="mt-2">
          <Link href="/animais/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Novo animal
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <strong className="font-semibold">Falha ao carregar animais</strong>
        <span className="text-destructive/90">{message}</span>
      </div>
    </div>
  );
}

// --------------------------- Helpers ---------------------------------------

function hasActiveFilters(
  especie: Especie | "todos",
  sexo: Sexo | "todos",
  query: string,
): boolean {
  return especie !== "todos" || sexo !== "todos" || query.trim().length > 0;
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

/**
 * Idade: prefere `data_nascimento`; senão usa `dados_geneticos.idade_anos`
 * (alimentado pelo seed sintético).
 */
function formatIdade(animal: Animal): string {
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
      if (months === 0) return `${years}a`;
      return `${years}a ${months}m`;
    }
  }
  const raw = animal.dados_geneticos?.["idade_anos"];
  const idadeAnos = typeof raw === "number" ? raw : null;
  if (idadeAnos === null) return "—";
  const years = Math.floor(idadeAnos);
  const months = Math.round((idadeAnos - years) * 12);
  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}a`;
  return `${years}a ${months}m`;
}

function formatEcc(animal: Animal): string {
  const raw = animal.dados_geneticos?.["ecc"];
  if (typeof raw !== "number") return "—";
  return raw.toFixed(1);
}
