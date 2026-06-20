/** Public API base (FastAPI on Vercel). No secrets. */
export function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
    "https://hacktofuture4.vercel.app"
  );
}
