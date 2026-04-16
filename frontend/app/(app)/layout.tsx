import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0" style={{ marginLeft: "var(--sidebar-width)" }}>
        {children}
      </div>
    </div>
  );
}
