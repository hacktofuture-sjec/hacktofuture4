import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "REKALL", template: "%s — REKALL" },
  description: "Memory-driven agentic CI/CD repair — detects failures, retrieves fixes from a learning vault, and applies repairs with human-in-the-loop governance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
