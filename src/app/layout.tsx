import "~/styles/globals.css";

import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Rajdhani } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "股票筛选平台",
  description: "股票投研工作流定制化平台",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Rajdhani({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const dataFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-data",
  weight: ["400", "500", "600"],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${bodyFont.variable} ${displayFont.variable} ${dataFont.variable}`}
    >
      <body className="antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
