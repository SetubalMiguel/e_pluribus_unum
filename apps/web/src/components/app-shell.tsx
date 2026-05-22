"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./nav-items";

/**
 * Estrutura visual da aplicação:
 *   - Header fixo no topo (h-16 mobile / h-20 desktop)
 *   - Sidebar à esquerda apenas em >=1024px
 *   - Bottom tab bar apenas em <640px
 *   - Em 640px–1023px (tablet) a navegação aparece inline no header
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <DesktopSidebar />
      <main
        className={cn(
          "pt-20 lg:pt-24",
          "pb-20 sm:pb-8",
          "lg:pl-64",
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}

// --------------------------- Header ---------------------------------------

function Header() {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b border-border bg-background",
        "h-20 lg:h-24",
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="pluribus unum — início">
          {/* width/height = dimensões intrínsecas (3100x1344) p/ Next saber a aspect ratio;
              `sizes` orienta a otimização — servimos ~280px na prática, não a PNG inteira. */}
          <Image
            src="/logo.png"
            alt="pluribus unum"
            width={3100}
            height={1344}
            sizes="280px"
            priority
            className="h-16 w-auto sm:h-20"
          />
        </Link>

        {/* Navegação inline para tablet (640–1023px). Mobile usa bottom tab; desktop usa sidebar. */}
        <nav
          aria-label="Navegação"
          className="hidden gap-1 sm:flex lg:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <HeaderNavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </header>
  );
}

function HeaderNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {item.label}
    </Link>
  );
}

// --------------------------- Sidebar (desktop) -----------------------------

function DesktopSidebar() {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Navegação lateral"
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-background",
        "pt-24 lg:flex",
        "flex-col",
      )}
    >
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "min-h-11", // touch target confortável
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        pluribus unum · gestão reprodutiva
      </div>
    </aside>
  );
}

// --------------------------- Bottom tab bar (mobile) -----------------------

function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação inferior"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background",
        "sm:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// --------------------------- Helpers --------------------------------------

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
