"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Baby,
  CalendarRange,
  Eye,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CicloDialog } from "@/components/ciclo-dialog";
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
import { ApiError, deleteCycle, listCycles } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  STATUS_CICLO_LABEL,
  type Ciclo,
  type Especie,
  type StatusCiclo,
} from "@/lib/types";

const STATUS_VARIANT: Record<StatusCiclo, "success" | "warning" | "destructive"> = {
  ativo: "warning",
  concluido_sucesso: "success",
  concluido_falha: "destructive",
};

const STATUS_CHIPS: { value: StatusCiclo | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ativo", label: "Ativos" },
  { value: "concluido_sucesso", label: "Sucesso" },
  { value: "concluido_falha", label: "Falha" },
];

const ESPECIE_CHIPS: { value: Especie | "todos"; label: string; emoji: string }[] = [
  { value: "todos", label: "Todas", emoji: "🌾" },
  { value: "bovino", label: "Bovinos", emoji: "🐄" },
  { value: "ovino", label: "Ovinos", emoji: "🐑" },
  { value: "caprino", label: "Caprinos", emoji: "🐐" },
];

export default function CiclosPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const pageSize = isDesktop ? 50 : 20;

  const [statusFilter, setStatusFilter] = useState<StatusCiclo | "todos">("todos");
  const [especie, setEspecie] = useState<Especie | "todos">("todos");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Ciclo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Ciclo | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, especie, pageSize]);

  const fetchList = useCallback(() => {
    if (!mounted) return;
    let active = true;
    setLoading(true);
    setError(null);
    listCycles({
      status: statusFilter === "todos" ? undefined : statusFilter,
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
        setError(err instanceof Error ? err.message : "Erro ao buscar ciclos");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mounted, statusFilter, especie, page, pageSize]);

  useEffect(() => {
    const cleanup = fetchList();
    return cleanup;
  }, [fetchList]);

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

  async function handleDelete(id: string) {
    const ok = window.confirm(
      "Remover este ciclo? A ação não pode ser desfeita.",
    );
    if (!ok) return;
    setDeleting(id);
    try {
      await deleteCycle(id);
      toast.success("Ciclo removido");
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erro desconhecido";
      toast.error("Falha ao remover ciclo", { description: message });
    } finally {
      setDeleting(null);
    }
  }

  function onSaved(updated: Ciclo) {
    setItems((prev) => {
      const exists = prev.some((c) => c.id === updated.id);
      if (exists) return prev.map((c) => (c.id === updated.id ? updated : c));
      return [updated, ...prev];
    });
    if (!items.some((c) => c.id === updated.id)) {
      setTotal((t) => t + 1);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Repeat className="h-6 w-6 text-primary" aria-hidden />
            Ciclos Reprodutivos
          </h1>
          <p className="text-sm text-muted-foreground">
            Cio → inseminação → diagnóstico → parto/falha. Agrupador de eventos
            por matriz.
          </p>
        </div>
        <Button
          type="button"
          className="hidden sm:inline-flex"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Novo ciclo
        </Button>
      </header>

      {/* Filtros */}
      <section
        aria-label="Filtros"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:gap-4 sm:p-4"
      >
        <ChipGroup
          ariaLabel="Filtrar por status"
          options={STATUS_CHIPS}
          selected={statusFilter}
          onSelect={setStatusFilter}
        />
        <ChipGroup
          ariaLabel="Filtrar por espécie"
          options={ESPECIE_CHIPS}
          selected={especie}
          onSelect={setEspecie}
        />
      </section>

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
            <strong className="font-semibold">Falha ao carregar ciclos</strong>
            <span className="text-destructive/90">{error}</span>
          </div>
        </div>
      ) : null}

      {loading ? <ListSkeleton isDesktop={isDesktop} /> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          hasFilters={statusFilter !== "todos" || especie !== "todos"}
          onCreate={() => setCreating(true)}
        />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {items.map((c) => (
              <CicloCard
                key={c.id}
                ciclo={c}
                onEdit={() => setEditing(c)}
                onDelete={() => handleDelete(c.id)}
                deleting={deleting === c.id}
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
                  <TableHead>Início</TableHead>
                  <TableHead>Encerramento</TableHead>
                  <TableHead>Parto</TableHead>
                  <TableHead>Cria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((c) => (
                  <CicloRow
                    key={c.id}
                    ciclo={c}
                    onEdit={() => setEditing(c)}
                    onDelete={() => handleDelete(c.id)}
                    deleting={deleting === c.id}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          ) : null}
        </>
      ) : null}

      {/* FAB mobile */}
      <button
        type="button"
        aria-label="Novo ciclo"
        onClick={() => setCreating(true)}
        className={cn(
          "fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg",
          "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "sm:hidden",
        )}
      >
        <Plus className="h-6 w-6" aria-hidden />
      </button>

      <CicloDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={onSaved}
      />
      <CicloDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        ciclo={editing}
        onSaved={onSaved}
      />
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

function CicloCard({
  ciclo,
  onEdit,
  onDelete,
  deleting,
}: {
  ciclo: Ciclo;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <Link
              href={`/animais/${ciclo.matriz.id}`}
              className="text-sm font-semibold hover:underline"
            >
              {ciclo.matriz.identificacao}
            </Link>
            <span className="text-xs text-muted-foreground">
              {ESPECIE_LABEL[ciclo.matriz.especie]}
            </span>
          </div>
          <Badge variant={STATUS_VARIANT[ciclo.status]}>
            {STATUS_CICLO_LABEL[ciclo.status]}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Field
            icon={CalendarRange}
            label="Início"
            value={formatDate(ciclo.data_inicio)}
          />
          <Field
            icon={CalendarRange}
            label="Encerramento"
            value={ciclo.data_fim ? formatDate(ciclo.data_fim) : "—"}
          />
          <Field
            icon={Baby}
            label="Parto"
            value={ciclo.parto_data ? formatDate(ciclo.parto_data) : "—"}
          />
          <Field
            icon={Baby}
            label="Cria"
            value={ciclo.cria?.identificacao ?? "—"}
            href={ciclo.cria ? `/animais/${ciclo.cria.id}` : undefined}
          />
        </dl>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CicloRow({
  ciclo,
  onEdit,
  onDelete,
  deleting,
}: {
  ciclo: Ciclo;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/animais/${ciclo.matriz.id}`}
          className="hover:underline"
        >
          {ciclo.matriz.identificacao}
        </Link>
      </TableCell>
      <TableCell>{ESPECIE_LABEL[ciclo.matriz.especie]}</TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDate(ciclo.data_inicio)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {ciclo.data_fim ? formatDate(ciclo.data_fim) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {ciclo.parto_data ? formatDate(ciclo.parto_data) : "—"}
      </TableCell>
      <TableCell>
        {ciclo.cria ? (
          <Link
            href={`/animais/${ciclo.cria.id}`}
            className="hover:underline"
          >
            {ciclo.cria.identificacao}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[ciclo.status]}>
          {STATUS_CICLO_LABEL[ciclo.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/animais/${ciclo.matriz.id}`}>
              <Eye className="h-4 w-4" aria-hidden />
              Ver matriz
            </Link>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-0.5 hover:text-primary hover:underline"
      >
        {content}
      </Link>
    );
  }
  return <div className="flex flex-col gap-0.5">{content}</div>;
}

// --------------------------- Estados ---------------------------------------

function EmptyState({
  hasFilters,
  onCreate,
}: {
  hasFilters: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
      <Repeat className="h-10 w-10 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">
        {hasFilters
          ? "Nenhum ciclo com esses filtros"
          : "Nenhum ciclo registrado"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Tente limpar os filtros para ver mais resultados."
          : "Registre o primeiro ciclo reprodutivo a partir do cio de uma matriz."}
      </p>
      {!hasFilters ? (
        <Button type="button" className="mt-2" onClick={onCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Novo ciclo
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
  const rows = isDesktop ? 8 : 5;
  if (isDesktop) {
    return (
      <div className="rounded-lg border border-border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-8 items-center gap-3 border-b px-3 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
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
              <Skeleton className="h-5 w-20 rounded-full" />
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}
