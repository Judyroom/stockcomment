import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const sans = Geist({ variable: "--font-sans-ui", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono-ui", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-serif-ui", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "Stock Commentary Studio",
  description: "Evidence-grounded, multi-analyst stock commentary with live market data and PDF RAG. Educational use only.",
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('sc.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${sans.variable} ${mono.variable} ${serif.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
