import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Tres roles, tres caras. Geist (el default de Next) hacía los tres y por eso el panel se leía
// como un starter: mismo gris, mismo ancho, misma voz para un título, una cifra de plata y un
// número de guía.
//   display  — Archivo variable, con el eje de ANCHO abierto: las cifras de plata van expandidas
//              (wdth 110). Un número ancho ocupa lugar y se lee como cifra, no como dato suelto.
//   sans     — Instrument Sans para leer: más angosta que Geist, entra mejor en 11 columnas.
//   mono     — IBM Plex Mono solo para códigos (tracking, keys de config): ahí el ancho fijo es
//              funcional, se comparan carácter por carácter.
const display = Archivo({ variable: "--font-display-face", subsets: ["latin"], axes: ["wdth"] });
const sans = Instrument_Sans({ variable: "--font-sans-ui", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-code", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "BioLabs Finanzas",
  description: "P&L COD por día de despacho",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica el tema ANTES de pintar (sin flash): localStorage o preferencia del SO. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
