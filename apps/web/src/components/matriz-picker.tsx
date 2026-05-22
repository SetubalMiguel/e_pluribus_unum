"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Beef,
  Check,
  Search,
  Venus,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { getStats, listAnimals } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  type Animal,
  type Especie,
  type EstatisticaEspecie,
} from "@/lib/types";

// Mesma estrutura visual da tela /animais (chips + busca + cards), porém
// fixada em Fêmeas. Cards são clicáveis e disparam onChange.

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

export function MatrizPicker({
  value,
  onChange,
}: {
  value: Animal | null;
  onChange: (animal: Animal | null) => void;
}) {
  const pageSize = 10;

  const [especie, setEspecie] = useState<Especie | "todos">("todos");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [page, setPage] = useState(1);

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contagens por espécie (chips) — vem do /stats. Falha aqui é não-fatal.
  const [counts, setCounts] = useState<Record<Especie, number> | null>(null);
  const [totalGeral, setTotalGeral] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [especie, debouncedQuery]);

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
        // Soma matrizes (total_matrizes) por espécie. O total geral some todas
        // as matrizes — usado no chip "Todos".
        let total = 0;
        data.por_especie.forEach((item: EstatisticaEspecie) => {
          next[item.especie] = item.total_matrizes;
          total += item.total_matrizes;
        });
        setCounts(next);
        setTotalGeral(total);
      })
      .catch(() => {
        if (active) setCounts({ bovino: 0, ovino: 0, caprino: 0 });
      });
    return () => {
      active = false;
    };
  }, []);

  // Se já há matriz selecionada, não busca lista — economiza requisição.
  useEffect(() => {
    if (value) return;
    let active = true;
    setLoading(true);
    setError(null);
    listAnimals({
      especie: especie === "todos" ? undefined : especie,
      sexo: "F",
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
        setError(err instanceof Error ? err.message : "Erro ao buscar matrizes");
        setAnimals([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [value, especie, debouncedQuery, page]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / pageSize) : 1),
    [total],
  );
  const visibleRange = useMemo(() => {
    if (total === 0) return null;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return { start, end };
  }, [page, total]);

  const handleSelect = useCallback(
    (animal: Animal) => {
      onChange(animal);
    },
    [onChange],
  );

  // ----- Caso A: matriz já selecionada ----- //
  if (value) {
    return <SelectedSummary animal={value} onClear={() => onChange(null)} />;
  }

  // ----- Caso B: picker ativo ----- //
  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <section
        aria-label="Filtros de matriz"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:p-4"
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
          onSelect={setEspecie}
        />
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar matriz por identificação…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Buscar matriz por identificação"
          />
        </div>
      </section>

      {/* Resumo da faixa */}
      {!loading && !error && visibleRange ? (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Mostrando {formatInt(visibleRange.start)}–
          {formatInt(visibleRange.end)} de {formatInt(total)}.
        </p>
      ) : null}

      {/* Erro */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {/* Skeleton */}
      {loading ? <ListSkeleton /> : null}

      {/* Vazio */}
      {!loading && !error && animals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma matriz encontrada com esses filtros.
        </div>
      ) : null}

      {/* Lista de cards clicáveis (mobile + tablet) e grid 2 col em sm */}
      {!loading && !error && animals.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {animals.map((a) => (
              <MatrizCard
                key={a.id}
                animal={a}
                onClick={() => handleSelect(a)}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// --------------------------- Sub-elementos ---------------------------------

function SelectedSummary({
  animal,
  onClear,
}: {
  animal: Animal;
  onClear: () => void;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          {animal.identificacao.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-1 flex-col">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4 text-primary" aria-hidden />
            {animal.identificacao}
          </span>
          <span className="text-xs text-muted-foreground">
            {ESPECIE_LABEL[animal.especie]}
            {animal.raca ? ` · ${animal.raca}` : ""} · Fêmea
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
        >
          Trocar matriz
        </Button>
      </CardContent>
    </Card>
  );
}

function MatrizCard({
  animal,
  onClick,
}: {
  animal: Animal;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="hover:border-primary/40 hover:bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Beef className="h-4 w-4 text-primary" aria-hidden />
              {animal.identificacao}
            </CardTitle>
            <Badge variant="muted" className="gap-1">
              <Venus className="h-3 w-3" aria-hidden />
              Fêmea
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {ESPECIE_LABEL[animal.especie]}
            {animal.raca ? ` · ${animal.raca}` : ""}
          </p>
        </CardHeader>
      </Card>
    </button>
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

// --------------------------- Paginação --------------------------------------

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <Button
        type="button"
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
        type="button"
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

// --------------------------- Skeleton ---------------------------------------

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-1 h-3 w-40" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

// --------------------------- Helpers ---------------------------------------

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}
