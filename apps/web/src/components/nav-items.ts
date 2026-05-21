import { Beef, Home, Sparkles, Syringe, type LucideIcon } from "lucide-react";

// Itens de navegação compartilhados entre header, sidebar e bottom tab bar.
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Início", href: "/", icon: Home },
  { label: "Animais", href: "/animais", icon: Beef },
  { label: "Inseminações", href: "/inseminacoes", icon: Syringe },
  { label: "Recomendações", href: "/recomendacoes", icon: Sparkles },
];
