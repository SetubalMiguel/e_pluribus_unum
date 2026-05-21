"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Beef,
  Loader2,
  PawPrint,
  Plus,
  Sparkles,
  Syringe,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStats } from "@/lib/api";
import {
  ESPECIE_LABEL,
  type EstatisticaEspecie,
  type StatsResponse,
} from "@/lib/types";

// Dashboard: 1 card destaque (totais consolidados) + 3 cards por espécie.
// Mobile: empilhados. Desktop: grid de 3 colunas para os cards por espécie.
export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getStats()
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err: unknown) => {
        if (active) {
          const message =
            err instanceof Error ? err.message : "Erro desconhecido";
          setError(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão geral do rebanho e dos resultados reprodutivos.
        </p>
      </header>

      {loading ? <LoadingState /> : null}
      {error && !loading ? <ErrorState message={error} /> : null}
      {stats && !loading && !error ? (
        stats.total_animais === 0 ? (
          <EmptyState />
        ) : (
          <StatsView stats={stats} />
        )
      ) : null}
    </div>
  );
}

// --------------------------- Subcomponentes --------------------------------

function StatsView({ stats }: { stats: StatsResponse }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <HighlightCard stats={stats} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Por espécie</h2>
        {stats.por_especie.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado por espécie disponível.
          </p>
        ) : (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            {stats.por_especie.map((item) => (
              <EspecieCard key={item.especie} item={item} />
            ))}
          </div>
        )}
      </section>

      <QuickActions />
    </div>
  );
}

// Mostrado no primeiro uso (nenhum animal cadastrado): convida o produtor
// a começar pelo cadastro, sem encher de números zerados.
function EmptyState() {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 px-4 py-10 text-center sm:py-14">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
          <PawPrint className="h-8 w-8" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Bem-vindo ao e pluribus unum
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Comece cadastrando o primeiro animal do rebanho. A partir dele você
            poderá registrar inseminações e usar a IA para recomendar
            cruzamentos.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/animais/novo">
            <Plus className="h-4 w-4" aria-hidden />
            Cadastrar primeiro animal
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Atalhos de ação visíveis quando já há dados — não obrigatórios mas úteis.
function QuickActions() {
  return (
    <section
      aria-label="Atalhos"
      className="grid gap-3 sm:grid-cols-3"
    >
      <ActionTile
        href="/animais/novo"
        title="Novo animal"
        description="Adicionar matriz ou reprodutor."
        Icon={Plus}
      />
      <ActionTile
        href="/inseminacoes/nova"
        title="Registrar inseminação"
        description="Com predição da IA embutida."
        Icon={Syringe}
      />
      <ActionTile
        href="/recomendacoes"
        title="Recomendar reprodutor"
        description="Top 5 cruzamentos por matriz."
        Icon={Sparkles}
      />
    </section>
  );
}

function ActionTile({
  href,
  title,
  description,
  Icon,
}: {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <ArrowRight
        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function HighlightCard({ stats }: { stats: StatsResponse }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-5 w-5" aria-hidden />
          Resumo consolidado
        </CardTitle>
        <CardDescription>
          Totais somando bovinos, ovinos e caprinos do produtor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric
            label="Animais ativos"
            value={formatInt(stats.total_animais)}
          />
          <Metric
            label="Inseminações"
            value={formatInt(stats.total_inseminacoes)}
          />
          <Metric
            label="Taxa de prenhez"
            value={formatPct(stats.taxa_prenhez_geral_pct)}
            highlight
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function EspecieCard({ item }: { item: EstatisticaEspecie }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Beef className="h-5 w-5 text-primary" aria-hidden />
            {ESPECIE_LABEL[item.especie] ?? item.especie}
          </CardTitle>
          <CardDescription>
            {formatInt(item.total_matrizes)} matrizes ·{" "}
            {formatInt(item.total_reprodutores)} reprodutores
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3">
          <Metric
            label="Total de animais"
            value={formatInt(item.total_animais)}
          />
          <Metric
            label="Inseminações"
            value={formatInt(item.total_inseminacoes)}
          />
          <Metric
            label="Taxa de prenhez"
            value={formatPct(item.taxa_prenhez_pct)}
            highlight
          />
          <Metric
            label="Aguardando"
            value={formatInt(item.inseminacoes_aguardando)}
            tone="warning"
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "warning";
}) {
  const valueClass = highlight
    ? "text-2xl font-semibold text-primary"
    : tone === "warning"
      ? "text-2xl font-semibold text-amber-600"
      : "text-2xl font-semibold text-foreground";
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={valueClass}>{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Carregando estatísticas…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <strong className="font-semibold">
          Não foi possível carregar os dados
        </strong>
        <span className="text-destructive/90">{message}</span>
        <span className="text-xs text-muted-foreground">
          Verifique se o backend está rodando em{" "}
          <code className="rounded bg-muted px-1 py-0.5">{apiUrl}</code>.
        </span>
      </div>
    </div>
  );
}

// --------------------------- Formatação ------------------------------------

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatPct(n: number): string {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)}%`;
}
