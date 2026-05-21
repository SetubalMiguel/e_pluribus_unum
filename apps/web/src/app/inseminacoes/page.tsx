"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Plus,
  Syringe,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getAnimal, listInseminations } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  RESULTADO_LABEL,
  type Animal,
  type Especie,
  type Inseminacao,
  type ResultadoDiagnostico,
} from "@/lib/types";

const STATUS_VARIANT: Record<
  ResultadoDiagnostico,
  "success" | "warning" | "destructive"
> = {
  prenhe: "success",
  aguardando: "warning",
  vazia: "destructive",
};

const RESULTADO_CHIPS: { value: ResultadoDiagnostico | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "prenhe", label: "Prenhes" },
  { value: "aguardando", label: "Aguardando" },
  { value: "vazia", label: "Vazias" },
];

const ESPECIE_CHIPS: { value: Especie | "todos"; label: string; emoji: string }[] = [
  { value: "todos", label: "Todas", emoji: "🌾" },
  { value: "bovino", label: "Bovinos", emoji: "🐄" },
  { value: "ovino", label: "Ovinos", emoji: "🐑" },
  { value: "caprino", label: "Caprinos", emoji: "🐐" },
];

export default function InseminacoesPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const pageSize = isDesktop ? 50 : 20;

  const [resultado, setResultado] = useState<ResultadoDiagnostico | "todos">(
    "todos",
  );
  const [especie, setEspecie] = useState<Especie | "todos">("todos");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Inseminacao[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [matrizes, setMatrizes] = useState<Record<string, Animal>>({});

  useEffect(() => {
    setPage(1);
  }, [resultado, especie, pageSize]);

  useEffect(() => {
    if (!mounted) return;
    let active = true;
    setLoading(true);
    setError(null);
    listInseminations({
      resultado: resultado === "todos" ? undefined : resultado,
      especie: especie === "todos" ? undefined : especie,
      page,
      page_size: pageSize,
    })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Erro ao buscar inseminações");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mounted, resultado, especie, page, pageSize]);

  // Enriquece com a identificação da matriz para cada linha.
  useEffect(() => {
    if (items.length === 0) {
      setMatrizes({});
      return;
    }
    const idsToFetch = Array.from(
      new Set(items.map((i) => i.matriz_id).filter((id) => !matrizes[id])),
    );
    if (idsToFetch.length === 0) return;

    let active = true;
    Promise.all(
      idsToFetch.map((id) =>
        getAnimal(id)
          .then((a) => [id, a] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((entries) => {
      if (!active) return;
      setMatrizes((prev) => {
        const next = { ...prev };
        for (const [id, animal] of entries) {
          if (animal) next[id] = animal;
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [items, matrizes]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / pageSize) : 1),
    [total, pageSize],
  );

  const visibleRange = useMemo(() => {
    if (total === 0) return null;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return { start, end };
  }, [page, pageSize, total]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Syringe className="h-6 w-6 text-primary" aria-hidden />
            Inseminações
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de eventos reprodutivos com a predição da IA na hora do
            registro.
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/inseminacoes/nova">
            <Plus className="h-4 w-4" aria-hidden />
            Nova inseminação
          </Link>
        </Button>
      </header>

      {/* Filtros */}
      <section
        aria-label="Filtros"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:gap-4 sm:p-4"
      >
        <ChipGroup
          ariaLabel="Filtrar por resultado"
          options={RESULTADO_CHIPS}
          selected={resultado}
          onSelect={setResultado}
        />
        <ChipGroup
          ariaLabel="Filtrar por espécie"
          options={ESPECIE_CHIPS}
          selected={especie}
          onSelect={setEspecie}
        />
      </section>

      {/* Resumo */}
      {!loading && !error && total > 0 && visibleRange ? (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Mostrando {formatInt(visibleRange.start)}–
          {formatInt(visibleRange.end)} de {formatInt(total)}.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <strong className="font-semibold">Falha ao carregar inseminações</strong>
            <span className="text-destructive/90">{error}</span>
          </div>
        </div>
      ) : null}

      {loading ? <ListSkeleton isDesktop={isDesktop} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState hasFilters={resultado !== "todos" || especie !== "todos"} />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {items.map((i) => (
              <InseminacaoCard
                key={i.id}
                item={i}
                matriz={matrizes[i.matriz_id]}
              />
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden rounded-lg border border-border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matriz</TableHead>
                  <TableHead>Espécie</TableHead>
                  <TableHead>Data do evento</TableHead>
                  <TableHead>Técnica</TableHead>
                  <TableHead>Predição IA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <InseminacaoRow
                    key={i.id}
                    item={i}
                    matriz={matrizes[i.matriz_id]}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
          />
        </>
      ) : null}

      {/* FAB mobile */}
      <Link
        href="/inseminacoes/nova"
        aria-label="Nova inseminação"
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

// --------------------------- Chips -----------------------------------------

interface ChipOption<V extends string> {
  value: V;
  label: string;
  emoji?: string;
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
  onSelect: (v: V) => void;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === selected;
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
            {opt.emoji ? <span aria-hidden>{opt.emoji}</span> : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --------------------------- Card e Row -------------------------------------

function InseminacaoCard({
  item,
  matriz,
}: {
  item: Inseminacao;
  matriz: Animal | undefined;
}) {
  return (
    <Link
      href={matriz ? `/animais/${item.matriz_id}` : "#"}
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors",
        matriz ? "hover:bg-muted/50" : "pointer-events-none",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">
            {matriz?.identificacao ?? <Skeleton className="h-4 w-24" />}
          </span>
          <span className="text-xs text-muted-foreground">
            {matriz ? ESPECIE_LABEL[matriz.especie] : ""}
            {matriz?.raca ? ` · ${matriz.raca}` : ""}
          </span>
        </div>
        <Badge variant={STATUS_VARIANT[item.resultado_diagnostico]}>
          {RESULTADO_LABEL[item.resultado_diagnostico]}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {formatDateTime(item.data_evento)} · {item.tecnica}
        </span>
        {item.predicao_prenhez !== null ? (
          <span className="font-semibold text-foreground">
            IA: {(item.predicao_prenhez * 100).toFixed(0)}%
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function InseminacaoRow({
  item,
  matriz,
}: {
  item: Inseminacao;
  matriz: Animal | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {matriz ? (
          <Link
            href={`/animais/${item.matriz_id}`}
            className="hover:underline"
          >
            {matriz.identificacao}
          </Link>
        ) : (
          <Skeleton className="h-4 w-24" />
        )}
      </TableCell>
      <TableCell>{matriz ? ESPECIE_LABEL[matriz.especie] : "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateTime(item.data_evento)}
      </TableCell>
      <TableCell>{item.tecnica}</TableCell>
      <TableCell className="text-muted-foreground">
        {item.predicao_prenhez !== null
          ? `${(item.predicao_prenhez * 100).toFixed(0)}%`
          : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[item.resultado_diagnostico]}>
          {RESULTADO_LABEL[item.resultado_diagnostico]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/animais/${item.matriz_id}`}>Ver matriz</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// --------------------------- Vazio + paginação + skeleton ------------------

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
      <Syringe className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">
        {hasFilters ? "Nenhuma inseminação nesse filtro" : "Nenhuma inseminação registrada"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Tente limpar os filtros para ver mais resultados."
          : "Registre o primeiro evento reprodutivo para começar."}
      </p>
      {!hasFilters ? (
        <Button asChild className="mt-2">
          <Link href="/inseminacoes/nova">
            <Plus className="h-4 w-4" aria-hidden />
            Nova inseminação
          </Link>
        </Button>
      ) : null}
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
  onChange: (n: number) => void;
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

function ListSkeleton({ isDesktop }: { isDesktop: boolean }) {
  const rows = isDesktop ? 8 : 6;
  if (isDesktop) {
    return (
      <div className="rounded-lg border border-border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-7 items-center gap-3 border-b px-3 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --------------------------- Helpers ---------------------------------------

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
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
