interface Props {
  variant: string;
  children: React.ReactNode;
}

const colorByVariant: Record<string, string> = {
  low: "var(--color-risk-low)",
  medium: "var(--color-risk-medium)",
  high: "var(--color-risk-high)",
  critical: "var(--color-failed)",
};

export default function Badge({ variant, children }: Props) {
  return (
    <span
      className="badge"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "999px",
        padding: "2px 8px",
        fontSize: "12px",
        color: colorByVariant[variant] ?? "var(--color-text-primary)",
      }}
    >
      {children}
    </span>
  );
}
