"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInsemination } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Inseminacao, ResultadoDiagnostico } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inseminacao: Inseminacao | null;
  /** Callback chamado após o PATCH terminar com sucesso. */
  onSaved?: (updated: Inseminacao) => void;
}

const OPCOES: {
  value: ResultadoDiagnostico;
  label: string;
  description: string;
  tone: "success" | "destructive" | "warning";
}[] = [
  {
    value: "prenhe",
    label: "Prenhe",
    description: "Diagnóstico positivo confirmado.",
    tone: "success",
  },
  {
    value: "vazia",
    label: "Vazia",
    description: "Não houve prenhez nesta inseminação.",
    tone: "destructive",
  },
  {
    value: "aguardando",
    label: "Aguardando",
    description: "Ainda não diagnosticada (volta o status).",
    tone: "warning",
  },
];

export function UpdateDiagnosticoDialog({
  open,
  onOpenChange,
  inseminacao,
  onSaved,
}: Props) {
  const [resultado, setResultado] = useState<ResultadoDiagnostico>("prenhe");
  const [dataDiagnostico, setDataDiagnostico] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quando o dialog abre com uma nova inseminação, repopula os campos.
  useEffect(() => {
    if (!open || !inseminacao) return;
    setResultado(
      inseminacao.resultado_diagnostico === "aguardando"
        ? "prenhe" // sugestão default: a maioria dos updates é confirmar gravidez
        : inseminacao.resultado_diagnostico,
    );
    setDataDiagnostico(inseminacao.data_diagnostico ?? todayISODate());
    setObservacoes(inseminacao.observacoes ?? "");
  }, [open, inseminacao]);

  if (!inseminacao) return null;

  const dataObrigatoria = resultado !== "aguardando";
  const podeSalvar =
    !submitting && (resultado === "aguardando" || dataDiagnostico.length === 10);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    setSubmitting(true);
    try {
      const updated = await updateInsemination(inseminacao.id, {
        resultado_diagnostico: resultado,
        // Pydantic date no backend: só envia se diagnosticada; null se volta pra aguardando.
        data_diagnostico: resultado === "aguardando" ? null : dataDiagnostico,
        observacoes: observacoes.trim() || null,
      });
      toast.success("Resultado atualizado", {
        description: resultadoToToast(resultado),
      });
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao atualizar resultado";
      toast.error("Não foi possível atualizar", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atualizar resultado da inseminação</DialogTitle>
          <DialogDescription>
            Evento de {formatDateTime(inseminacao.data_evento)} · {inseminacao.tecnica}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Opções de resultado */}
          <div className="flex flex-col gap-2">
            <Label>Resultado *</Label>
            <div className="flex flex-col gap-2">
              {OPCOES.map((opt) => {
                const active = resultado === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setResultado(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-12 items-start gap-3 rounded-md border p-3 text-left transition-colors",
                      active
                        ? toneActive(opt.tone)
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                        active
                          ? toneRingActive(opt.tone)
                          : "border-input",
                      )}
                    >
                      {active ? (
                        <Check className="h-3 w-3" aria-hidden />
                      ) : null}
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data do diagnóstico (só quando há diagnóstico) */}
          {dataObrigatoria ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_diagnostico">Data do diagnóstico *</Label>
              <Input
                id="data_diagnostico"
                type="date"
                value={dataDiagnostico}
                onChange={(e) => setDataDiagnostico(e.target.value)}
                max={todayISODate()}
                required
              />
              <p className="text-xs text-muted-foreground">
                Quando o veterinário confirmou o resultado.
              </p>
            </div>
          ) : null}

          {/* Observações */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="diag_observacoes">Observações (opcional)</Label>
            <textarea
              id="diag_observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Notas do diagnóstico (ex.: ultrassom, palpação, idade gestacional)…"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Salvar resultado
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------- Helpers ---------------------------------------

function toneActive(tone: "success" | "destructive" | "warning"): string {
  if (tone === "success")
    return "border-success bg-success/10 text-success-foreground";
  if (tone === "destructive")
    return "border-destructive bg-destructive/10 text-destructive";
  return "border-warning bg-warning/10 text-foreground";
}

function toneRingActive(tone: "success" | "destructive" | "warning"): string {
  if (tone === "success") return "border-success bg-success text-success-foreground";
  if (tone === "destructive")
    return "border-destructive bg-destructive text-destructive-foreground";
  return "border-warning bg-warning text-warning-foreground";
}

function resultadoToToast(r: ResultadoDiagnostico): string {
  if (r === "prenhe") return "Inseminação confirmada como prenhe.";
  if (r === "vazia") return "Inseminação registrada como vazia.";
  return "Status revertido para aguardando.";
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
