"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Ícone "i" discreto que mostra um tooltip ao passar o mouse — usado em
 * cabeçalhos de tabela e células com siglas técnicas (ECC, IATF, etc).
 * No mobile não há hover, mas as tabelas só aparecem em telas >= sm, e
 * mantemos a abreviação visível por extenso onde a tela permite.
 */
export function InfoHint({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              className,
            )}
          >
            <Info className="h-3 w-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
