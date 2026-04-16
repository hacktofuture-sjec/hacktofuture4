import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "REKALL", template: "%s — REKALL" },
  description: "Memory-driven agentic CI/CD repair — detects failures, retrieves fixes from a learning vault, and applies repairs with human-in-the-loop governance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rekall-theme')||'dark';var d=document.documentElement;if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.classList.toggle('dark',t==='dark');d.classList.toggle('light',t==='light')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
