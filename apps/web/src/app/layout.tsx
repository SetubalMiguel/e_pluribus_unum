import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";

import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // Título do sistema: "e pluribus unum — de muitos, um".
  // Páginas individuais que setarem `title` próprio recebem o sufixo curto.
  title: {
    default: "e pluribus unum — de muitos, um",
    template: "%s · pluribus unum",
  },
  description:
    "Plataforma de gestão genética e reprodutiva para bovinos, ovinos e caprinos.",
  manifest: "/manifest.json",
  applicationName: "pluribus unum",
  icons: {
    // icon.png é a marca; os PNGs em tamanhos fixos atendem instalações de PWA.
    // ?v=2 quebra o cache agressivo de favicon do browser quando trocamos os arquivos.
    icon: [
      { url: "/icon.png?v=2", type: "image/png" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon.png?v=2",
    shortcut: "/icon.png?v=2",
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
