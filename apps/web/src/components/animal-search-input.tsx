"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { listAnimals } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ESPECIE_LABEL, type Animal, type Especie, type Sexo } from "@/lib/types";

interface AnimalSearchInputProps {
  /** Filtros estáticos (sexo, espécie). */
  sexo?: Sexo;
  especie?: Especie;
  value: Animal | null;
  onChange: (animal: Animal | null) => void;
  placeholder?: string;
  /** Quando informado, exclui esse ID do resultado (ex.: matriz já selecionada). */
  excludeId?: string;
  disabled?: boolean;
  inputId?: string;
}

/**
 * Autocomplete de animais com debounce e busca contra GET /animals.
 * Mostra até 8 resultados; teclado: ↑/↓ navega, Enter seleciona, Esc fecha.
 */
export function AnimalSearchInput({
  sexo,
  especie,
  value,
  onChange,
  placeholder,
  excludeId,
  disabled,
  inputId,
}: AnimalSearchInputProps) {
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);

  // Busca quando query/filtros mudam — apenas com dropdown aberto.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    listAnimals({
      sexo,
      especie,
      busca: debouncedQuery.trim() || undefined,
      page: 1,
      page_size: 8,
      ativo: true,
    })
      .then((res) => {
        if (!active) return;
        const filtered = excludeId
          ? res.items.filter((a) => a.id !== excludeId)
          : res.items;
        setResults(filtered);
        setActiveIndex(filtered.length > 0 ? 0 : -1);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, debouncedQuery, sexo, especie, excludeId]);

  // Click fora fecha o dropdown.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = useCallback(
    (animal: Animal) => {
      onChange(animal);
      setQuery("");
      setOpen(false);
      setResults([]);
    },
    [onChange],
  );

  const clear = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // SEMPRE engole Enter — esse input está dentro de um <form> e o "Go/Search"
    // do teclado mobile dispararia o submit implícito se a gente deixasse passar.
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (!open) {
        setOpen(true);
      } else {
        const item = results[activeIndex];
        if (item) select(item);
      }
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Quando há valor selecionado, mostra o chip + botão de limpar.
  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {value.identificacao.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold">{value.identificacao}</span>
          <span className="text-xs text-muted-foreground">
            {ESPECIE_LABEL[value.especie]}
            {value.raca ? ` · ${value.raca}` : ""}
            {value.sexo === "F" ? " · Fêmea" : " · Macho"}
          </span>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label="Remover seleção"
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder={placeholder ?? "Buscar pela identificação…"}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        role="combobox"
        className="pl-9"
      />
      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {debouncedQuery.trim()
                ? "Nenhum animal encontrado."
                : "Digite para buscar."}
            </div>
          ) : (
            <ul className="py-1">
              {results.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(a)}
                    className={cn(
                      "flex w-full min-h-11 items-center gap-3 px-3 py-2 text-left text-sm",
                      i === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {a.identificacao.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{a.identificacao}</span>
                      <span className="text-xs text-muted-foreground">
                        {ESPECIE_LABEL[a.especie]}
                        {a.raca ? ` · ${a.raca}` : ""}
                      </span>
                    </span>
                    {i === activeIndex ? (
                      <Check
                        className="h-4 w-4 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
