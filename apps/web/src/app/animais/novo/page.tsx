"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ApiError, createAnimal } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AnimalCreate, Especie, Sexo } from "@/lib/types";

// --------------------------- Catálogos --------------------------------------

const RACAS_POR_ESPECIE: Record<Especie, string[]> = {
  bovino: ["Nelore", "Senepol", "Angus", "Brahman", "Gir", "Guzera", "Mestico"],
  ovino: [
    "Santa Ines",
    "Morada Nova",
    "Somalis",
    "Dorper",
    "White Dorper",
    "Mestico",
  ],
  caprino: [
    "Anglo Nubiana",
    "Boer",
    "Saanen",
    "Alpina",
    "Pardo Alpina",
    "Caninde",
    "Moxoto",
  ],
};

const ESPECIE_BOTOES: { value: Especie; label: string; emoji: string }[] = [
  { value: "bovino", label: "Bovino", emoji: "🐄" },
  { value: "ovino", label: "Ovino", emoji: "🐑" },
  { value: "caprino", label: "Caprino", emoji: "🐐" },
];

const ESPECIE_NOME: Record<Especie, string> = {
  bovino: "Bovino",
  ovino: "Ovino",
  caprino: "Caprino",
};

const SEXO_NOME: Record<Sexo, string> = { M: "Macho", F: "Fêmea" };

// --------------------------- Validação --------------------------------------

const formSchema = z
  .object({
    especie: z.enum(["bovino", "ovino", "caprino"], {
      message: "Selecione a espécie",
    }),
    identificacao: z
      .string()
      .trim()
      .min(1, "Informe a identificação")
      .max(50, "Máximo de 50 caracteres"),
    sexo: z.enum(["M", "F"], { message: "Selecione o sexo" }),
    raca: z.string().min(1, "Selecione a raça"),
    linhagem: z.string().max(120, "Máximo de 120 caracteres").optional(),
    origem: z.string().max(120, "Máximo de 120 caracteres").optional(),
    data_nascimento: z
      .string()
      .optional()
      .refine(
        (v) => !v || !Number.isNaN(new Date(v).getTime()),
        "Data inválida",
      )
      .refine(
        (v) => !v || new Date(v).getTime() <= Date.now(),
        "A data não pode estar no futuro",
      ),
    idade_anos: z
      .number({ message: "Informe a idade em anos" })
      .min(0, "Idade não pode ser negativa")
      .max(30, "Máximo de 30 anos"),
    ecc: z
      .number()
      .min(1, "ECC mínimo é 1")
      .max(5, "ECC máximo é 5")
      .optional(),
    paridade: z
      .number()
      .int("Paridade deve ser um número inteiro")
      .min(0, "Paridade não pode ser negativa")
      .max(20, "Máximo de 20")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sexo === "F") {
      if (data.ecc === undefined || Number.isNaN(data.ecc)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o ECC (1 a 5)",
          path: ["ecc"],
        });
      }
      if (data.paridade === undefined || Number.isNaN(data.paridade)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a paridade",
          path: ["paridade"],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: Partial<FormValues> = {
  especie: undefined,
  identificacao: "",
  sexo: undefined,
  raca: "",
  linhagem: "",
  origem: "",
  data_nascimento: "",
  idade_anos: undefined,
  ecc: 3,
  paridade: 0,
};

// --------------------------- Página -----------------------------------------

type WizardStep = 1 | 2 | 3;

export default function NovoAnimalPage() {
  const router = useRouter();

  // Detecta layout depois do mount (evita flicker na escolha wizard vs. flat).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [step, setStep] = useState<WizardStep>(1);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES as FormValues,
    mode: "onBlur",
  });

  const especie = form.watch("especie");
  const sexo = form.watch("sexo");

  // Quando a espécie muda, reseta a raça (catálogo é específico da espécie).
  useEffect(() => {
    if (!especie) return;
    const racaAtual = form.getValues("raca");
    if (racaAtual && !RACAS_POR_ESPECIE[especie].includes(racaAtual)) {
      form.setValue("raca", "", { shouldValidate: false, shouldDirty: true });
    }
  }, [especie, form]);

  // Quando sexo muda para macho, limpa ECC/paridade.
  useEffect(() => {
    if (sexo === "M") {
      form.setValue("ecc", undefined, { shouldValidate: false });
      form.setValue("paridade", undefined, { shouldValidate: false });
    } else if (sexo === "F") {
      // Restaura defaults se estavam zerados.
      if (form.getValues("ecc") === undefined) {
        form.setValue("ecc", 3, { shouldValidate: false });
      }
      if (form.getValues("paridade") === undefined) {
        form.setValue("paridade", 0, { shouldValidate: false });
      }
    }
  }, [sexo, form]);

  // Submit final.
  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const dadosGeneticos: Record<string, unknown> = {
        idade_anos: values.idade_anos,
      };
      if (values.sexo === "F") {
        dadosGeneticos.ecc = values.ecc;
        dadosGeneticos.paridade = values.paridade;
      }

      const payload: AnimalCreate = {
        especie: values.especie,
        identificacao: values.identificacao.trim(),
        sexo: values.sexo,
        raca: values.raca,
        linhagem: values.linhagem?.trim() || null,
        origem: values.origem?.trim() || null,
        data_nascimento: values.data_nascimento || null,
        dados_geneticos: dadosGeneticos,
      };

      await createAnimal(payload);
      toast.success("Animal cadastrado com sucesso", {
        description: `${values.identificacao} foi adicionado ao rebanho.`,
      });
      router.push("/animais");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        form.setError("identificacao", {
          type: "manual",
          message: "Já existe um animal com essa identificação",
        });
        if (mounted && !isDesktop) setStep(1);
        toast.error("Identificação duplicada", {
          description: "Escolha outra identificação para este animal.",
        });
      } else {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Não foi possível cadastrar o animal", {
          description: message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  });

  // Cancelar: se vazio, volta direto; se sujo, confirma.
  const onCancel = () => {
    if (form.formState.isDirty) {
      const ok = window.confirm(
        "Descartar este cadastro? As informações preenchidas serão perdidas.",
      );
      if (!ok) return;
    }
    router.push("/animais");
  };

  // Validação parcial por passo (mobile).
  const goNext = async () => {
    const fieldsByStep: Record<WizardStep, Path<FormValues>[]> = {
      1: ["especie", "identificacao", "sexo", "raca"],
      2: sexo === "F" ? ["idade_anos", "ecc", "paridade"] : ["idade_anos"],
      3: [],
    };
    const ok = await form.trigger(fieldsByStep[step]);
    if (!ok) return;
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  // Estrutura compartilhada entre wizard e desktop.
  const useWizard = mounted && !isDesktop;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-5 pb-32 lg:pb-0">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/animais"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Voltar para animais
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Cadastrar animal
            </h1>
            <p className="text-sm text-muted-foreground">
              Adicione um novo animal ao rebanho do produtor.
            </p>
          </div>
        </header>

        {/* Indicador de passos — apenas mobile/tablet */}
        {useWizard ? <StepIndicator step={step} /> : null}

        {useWizard ? (
          <>
            {step === 1 ? (
              <BasicoSection form={form} />
            ) : step === 2 ? (
              <GeneticoSection form={form} sexo={sexo} />
            ) : (
              <ConfirmacaoSection values={form.getValues()} />
            )}
          </>
        ) : (
          // Desktop: layout único, duas colunas.
          <div className="grid gap-6 lg:grid-cols-2">
            <BasicoSection form={form} />
            <GeneticoSection form={form} sexo={sexo} />
          </div>
        )}
      </div>

      {/* Barra de ações — fixa no rodapé em mobile, inline em desktop */}
      <ActionBar
        useWizard={useWizard}
        step={step}
        submitting={submitting}
        canSubmit={!submitting}
        onCancel={onCancel}
        onNext={goNext}
        onBack={goBack}
      />
    </form>
  );
}

// --------------------------- Indicador de passos ----------------------------

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Básico",
  2: "Genético",
  3: "Confirmação",
};

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

// --------------------------- Seções -----------------------------------------

type FormType = ReturnType<typeof useForm<FormValues>>;

function BasicoSection({ form }: { form: FormType }) {
  const { control, register, formState, watch, setValue } = form;
  const especie = watch("especie");
  const racas = especie ? RACAS_POR_ESPECIE[especie] : [];

  return (
    <section
      aria-labelledby="sec-basico"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="sec-basico" className="text-base font-semibold">
        Dados básicos
      </h2>

      {/* Espécie */}
      <div className="flex flex-col gap-2">
        <Label>Espécie *</Label>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {ESPECIE_BOTOES.map((opt) => {
            const active = especie === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setValue("especie", opt.value, { shouldDirty: true })
                }
                aria-pressed={active}
                className={cn(
                  "flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                <span className="text-3xl" aria-hidden>
                  {opt.emoji}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
        <FieldError message={formState.errors.especie?.message} />
      </div>

      {/* Identificação */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="identificacao">Identificação *</Label>
        <Input
          id="identificacao"
          placeholder="Ex.: BO-2025-001"
          autoComplete="off"
          aria-invalid={!!formState.errors.identificacao}
          {...register("identificacao")}
        />
        <FieldError message={formState.errors.identificacao?.message} />
      </div>

      {/* Sexo */}
      <div className="flex flex-col gap-2">
        <Label>Sexo *</Label>
        <Controller
          control={control}
          name="sexo"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={field.onChange}
              className="grid grid-cols-2 gap-2"
            >
              {(["M", "F"] as const).map((value) => {
                const active = field.value === value;
                return (
                  <Label
                    key={value}
                    htmlFor={`sexo-${value}`}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    <RadioGroupItem id={`sexo-${value}`} value={value} />
                    <span>{SEXO_NOME[value]}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          )}
        />
        <FieldError message={formState.errors.sexo?.message} />
      </div>

      {/* Raça */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="raca">Raça *</Label>
        <Controller
          control={control}
          name="raca"
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              disabled={!especie}
            >
              <SelectTrigger id="raca" aria-invalid={!!formState.errors.raca}>
                <SelectValue
                  placeholder={
                    especie ? "Selecione a raça" : "Escolha a espécie primeiro"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {racas.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.raca?.message} />
      </div>

      {/* Linhagem */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="linhagem">Linhagem (opcional)</Label>
        <Input
          id="linhagem"
          placeholder="Ex.: linha BR-Center"
          autoComplete="off"
          {...register("linhagem")}
        />
        <FieldError message={formState.errors.linhagem?.message} />
      </div>

      {/* Origem */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="origem">Origem (opcional)</Label>
        <Input
          id="origem"
          placeholder="Fazenda de origem, leilão, etc."
          autoComplete="off"
          {...register("origem")}
        />
        <FieldError message={formState.errors.origem?.message} />
      </div>

      {/* Data nascimento */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="data_nascimento">Data de nascimento (opcional)</Label>
        <Input
          id="data_nascimento"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          {...register("data_nascimento")}
        />
        <FieldError message={formState.errors.data_nascimento?.message} />
      </div>
    </section>
  );
}

function GeneticoSection({
  form,
  sexo,
}: {
  form: FormType;
  sexo: Sexo | undefined;
}) {
  const { control, register, formState } = form;

  return (
    <section
      aria-labelledby="sec-genetico"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="sec-genetico" className="text-base font-semibold">
          Dados genéticos
        </h2>
        <p className="text-xs text-muted-foreground">
          Esses dados alimentam o modelo de predição de prenhez.
        </p>
      </div>

      {sexo === "F" ? (
        <>
          {/* ECC */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ecc">Escore de condição corporal (ECC) *</Label>
              <Controller
                control={control}
                name="ecc"
                render={({ field }) => (
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {typeof field.value === "number"
                      ? field.value.toFixed(1)
                      : "—"}
                  </span>
                )}
              />
            </div>
            <Controller
              control={control}
              name="ecc"
              render={({ field }) => (
                <Slider
                  id="ecc"
                  min={1}
                  max={5}
                  step={0.1}
                  value={[typeof field.value === "number" ? field.value : 3]}
                  onValueChange={(v) => field.onChange(v[0])}
                />
              )}
            />
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>1 — magra</span>
              <span>3 — ideal</span>
              <span>5 — obesa</span>
            </div>
            <FieldError message={formState.errors.ecc?.message} />
          </div>

          {/* Paridade */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="paridade">Paridade *</Label>
            <Input
              id="paridade"
              type="number"
              min={0}
              max={20}
              step={1}
              inputMode="numeric"
              aria-invalid={!!formState.errors.paridade}
              {...register("paridade", {
                setValueAs: (v) =>
                  v === "" || v === null ? undefined : Number(v),
              })}
            />
            <p className="text-xs text-muted-foreground">
              Número de partos anteriores. Use 0 para novilhas.
            </p>
            <FieldError message={formState.errors.paridade?.message} />
          </div>
        </>
      ) : null}

      {/* Idade (ambos) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="idade_anos">Idade em anos *</Label>
        <Input
          id="idade_anos"
          type="number"
          min={0}
          max={30}
          step={0.1}
          inputMode="decimal"
          placeholder="Ex.: 3.5"
          aria-invalid={!!formState.errors.idade_anos}
          {...register("idade_anos", {
            setValueAs: (v) =>
              v === "" || v === null ? undefined : Number(v),
          })}
        />
        <FieldError message={formState.errors.idade_anos?.message} />
      </div>

      {sexo === undefined ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Selecione o sexo do animal no passo anterior para liberar os campos
          específicos de fêmea.
        </p>
      ) : null}
    </section>
  );
}

function ConfirmacaoSection({ values }: { values: FormValues }) {
  return (
    <section
      aria-labelledby="sec-conf"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="sec-conf" className="text-base font-semibold">
        Confirme os dados
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <Item label="Espécie" value={ESPECIE_NOME[values.especie]} />
        <Item label="Sexo" value={SEXO_NOME[values.sexo]} />
        <Item label="Identificação" value={values.identificacao} />
        <Item label="Raça" value={values.raca} />
        <Item label="Linhagem" value={values.linhagem || "—"} />
        <Item label="Origem" value={values.origem || "—"} />
        <Item
          label="Nascimento"
          value={
            values.data_nascimento
              ? new Date(values.data_nascimento).toLocaleDateString("pt-BR")
              : "—"
          }
        />
        <Item
          label="Idade"
          value={
            typeof values.idade_anos === "number"
              ? `${values.idade_anos} anos`
              : "—"
          }
        />
        {values.sexo === "F" ? (
          <>
            <Item
              label="ECC"
              value={
                typeof values.ecc === "number" ? values.ecc.toFixed(1) : "—"
              }
            />
            <Item
              label="Paridade"
              value={
                typeof values.paridade === "number"
                  ? String(values.paridade)
                  : "—"
              }
            />
          </>
        ) : null}
      </dl>
      <Badge variant="muted" className="self-start">
        Revise antes de salvar
      </Badge>
    </section>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

// --------------------------- Barra de ações ---------------------------------

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
          "px-4 pt-3",
          "pb-[max(env(safe-area-inset-bottom),0.75rem)]",
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
                  Salvar animal
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
  // Desktop: inline no rodapé.
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
            Salvar animal
          </>
        )}
      </Button>
    </div>
  );
}

// --------------------------- Mensagem de erro de campo ----------------------

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 text-xs font-medium text-destructive"
    >
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {message}
    </p>
  );
}

export const dynamic = "force-dynamic";
