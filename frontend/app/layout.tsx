import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T3PS2 — Kubernetes Incident Response",
  description: "Autonomous self-healing reliability loop for Kubernetes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
