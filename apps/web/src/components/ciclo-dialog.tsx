"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AnimalSearchInput } from "@/components/animal-search-input";
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
import { ApiError, createCycle, updateCycle } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ESPECIE_LABEL,
  STATUS_CICLO_LABEL,
  type Animal,
  type Ciclo,
  type CicloAnimalBrief,
  type StatusCiclo,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Modo: edição de ciclo existente OU criação. */
  ciclo?: Ciclo | null;
  /** Se passado em modo create, matriz fica travada (vinda da ficha do animal). */
  defaultMatriz?: CicloAnimalBrief | null;
  onSaved?: (updated: Ciclo) => void;
}

const STATUS_OPCOES: {
  value: StatusCiclo;
  description: string;
  tone: "primary" | "success" | "destructive";
}[] = [
  {
    value: "ativo",
    description: "Em andamento — sem parto ou falha confirmados.",
    tone: "primary",
  },
  {
    value: "concluido_sucesso",
    description: "Ciclo terminou em parto (registre data e cria, se houver).",
    tone: "success",
  },
  {
    value: "concluido_falha",
    description: "Ciclo encerrado sem prenhez confirmada.",
    tone: "destructive",
  },
];

export function CicloDialog({
  open,
  onOpenChange,
  ciclo,
  defaultMatriz,
  onSaved,
}: Props) {
  const isEdit = !!ciclo;

  // Estado dos campos. Datas vão como string "YYYY-MM-DD".
  const [matriz, setMatriz] = useState<Animal | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [status, setStatus] = useState<StatusCiclo>("ativo");
  const [dataFim, setDataFim] = useState("");
  const [partoData, setPartoData] = useState("");
  const [cria, setCria] = useState<Animal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quando o dialog abre, popula os campos do ciclo ou usa defaults.
  useEffect(() => {
    if (!open) return;
    if (ciclo) {
      // Modo edit — matriz vem do ciclo (não é um Animal completo, mas o
      // SelectedMatrizSummary só precisa de id/identificacao/especie).
      setMatriz(asAnimalLike(ciclo.matriz));
      setDataInicio(ciclo.data_inicio);
      setStatus(ciclo.status);
      setDataFim(ciclo.data_fim ?? "");
      setPartoData(ciclo.parto_data ?? "");
      setCria(ciclo.cria ? asAnimalLike(ciclo.cria) : null);
    } else {
      setMatriz(defaultMatriz ? asAnimalLike(defaultMatriz) : null);
      setDataInicio(todayISODate());
      setStatus("ativo");
      setDataFim("");
      setPartoData("");
      setCria(null);
    }
  }, [open, ciclo, defaultMatriz]);

  // No modo create + status ativo, parto/cria não fazem sentido — bloqueia.
  const partoFieldsEnabled = status !== "ativo";

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!matriz) return false;
    if (!dataInicio) return false;
    if (dataFim && dataFim < dataInicio) return false;
    if (partoData && partoData < dataInicio) return false;
    if (status === "ativo" && (partoData || cria)) return false;
    return true;
  }, [submitting, matriz, dataInicio, dataFim, partoData, cria, status]);

  async function handleSubmit() {
    if (!canSubmit || !matriz) return;
    setSubmitting(true);
    try {
      const body = {
        matriz_id: matriz.id,
        data_inicio: dataInicio,
        status,
        data_fim: dataFim || null,
        parto_data: partoFieldsEnabled && partoData ? partoData : null,
        cria_id: partoFieldsEnabled && cria ? cria.id : null,
      };
      const result = isEdit
        ? await updateCycle(ciclo!.id, body)
        : await createCycle(body);
      toast.success(isEdit ? "Ciclo atualizado" : "Ciclo criado", {
        description: `Matriz ${matriz.identificacao} · ${STATUS_CICLO_LABEL[status]}`,
      });
      onSaved?.(result);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erro desconhecido";
      toast.error("Falha ao salvar ciclo", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar ciclo reprodutivo" : "Novo ciclo reprodutivo"}
          </DialogTitle>
          <DialogDescription>
            Agrupa eventos desta matriz do cio até o parto ou falha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Matriz — travada no edit ou quando vem da ficha */}
          <div className="flex flex-col gap-2">
            <Label>Matriz</Label>
            {isEdit || defaultMatriz ? (
              <MatrizLocked animal={matriz} />
            ) : (
              <AnimalSearchInput
                sexo="F"
                value={matriz}
                onChange={setMatriz}
                placeholder="Buscar matriz por identificação…"
              />
            )}
          </div>

          {/* Data início */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ciclo-inicio">Data de início (cio) *</Label>
            <Input
              id="ciclo-inicio"
              type="date"
              value={dataInicio}
              max={todayISODate()}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          {/* Status — 3 botões grandes */}
          <div className="flex flex-col gap-2">
            <Label>Status do ciclo</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {STATUS_OPCOES.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-[80px] flex-col items-start gap-1 rounded-md border-2 px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? opt.tone === "success"
                          ? "border-success bg-success/10 text-success"
                          : opt.tone === "destructive"
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    <span className="font-semibold">
                      {STATUS_CICLO_LABEL[opt.value]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data fim (opcional) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ciclo-fim">Data de encerramento (opcional)</Label>
            <Input
              id="ciclo-fim"
              type="date"
              value={dataFim}
              min={dataInicio || undefined}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          {/* Parto + cria — habilitados só com status concluído */}
          <div
            className={cn(
              "grid gap-4 rounded-md border border-border bg-muted/30 p-3",
              !partoFieldsEnabled && "opacity-60",
            )}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Resultado do ciclo
              {!partoFieldsEnabled
                ? " — escolha um status concluído para habilitar"
                : ""}
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ciclo-parto">Data do parto</Label>
              <Input
                id="ciclo-parto"
                type="date"
                value={partoData}
                min={dataInicio || undefined}
                disabled={!partoFieldsEnabled}
                onChange={(e) => setPartoData(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cria (opcional)</Label>
              <AnimalSearchInput
                value={cria}
                onChange={setCria}
                disabled={!partoFieldsEnabled}
                placeholder="Buscar animal cadastrado…"
                excludeId={matriz?.id}
              />
              <p className="text-xs text-muted-foreground">
                Se a cria já tem cadastro, vincule aqui. Caso contrário, deixe
                vazio e cadastre depois.
              </p>
            </div>
          </div>
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
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden />
                {isEdit ? "Salvar alterações" : "Criar ciclo"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------- Helpers ---------------------------------------

function MatrizLocked({ animal }: { animal: Animal | null }) {
  if (!animal) return null;
  return (
    <div className="flex items-center gap-3 rounded-md border border-input bg-muted/40 px-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {animal.identificacao.slice(0, 2).toUpperCase()}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{animal.identificacao}</span>
        <span className="text-xs text-muted-foreground">
          {ESPECIE_LABEL[animal.especie]} · Fêmea
        </span>
      </div>
    </div>
  );
}

// CicloAnimalBrief não tem todos os campos de Animal, mas o AnimalSearchInput
// e o MatrizLocked só leem id/identificacao/especie/raca. Cast seguro p/ o uso.
function asAnimalLike(brief: CicloAnimalBrief): Animal {
  return {
    id: brief.id,
    identificacao: brief.identificacao,
    especie: brief.especie,
    sexo: "F",
    raca: null,
    linhagem: null,
    origem: null,
    data_nascimento: null,
    dados_geneticos: {},
    ativo: true,
    created_at: "",
    updated_at: "",
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISODate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
