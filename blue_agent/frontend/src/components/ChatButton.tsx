interface ChatButtonProps {
  accent?: string;
  onClick?: () => void;
}

export function ChatButton({ accent = "#58a6ff", onClick }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: accent,
        color: "#0d1117",
        border: "none",
        borderRadius: 999,
        padding: "12px 20px",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 1,
        cursor: "pointer",
        boxShadow: `0 4px 16px ${accent}66`,
      }}
    >
      💬 CHAT
    </button>
  );
}
