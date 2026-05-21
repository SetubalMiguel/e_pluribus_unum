import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

// Página 404 do App Router — Next renderiza esta rota quando notFound()
// é chamado ou quando uma URL não casa com nenhuma página.
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card px-4 py-16 text-center sm:py-24">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-8 w-8" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          O link pode ter sido movido ou nunca existiu. Volte para o início e
          siga pela navegação.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden />
            Ir para o dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/animais">Ver animais</Link>
        </Button>
      </div>
    </div>
  );
}
