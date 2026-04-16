"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertOctagon } from "lucide-react";
import { api } from "@/lib/api-client";

interface Props {
  incidentId: string;
  onResolved: () => void;
}

export function ApprovalPanel({ incidentId, onResolved }: Props) {
  const [notes,   setNotes]   = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done,    setDone]    = useState<"approved" | "rejected" | null>(null);

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    try {
      if (action === "approve") {
        await api.approveIncident(incidentId, "human", notes || undefined);
      } else {
        await api.rejectIncident(incidentId, "human", notes || undefined);
      }
      setDone(action === "approve" ? "approved" : "rejected");
      onResolved();
    } finally {
      setLoading(null);
    }
  }

  if (done) {
    const isApproved = done === "approved";
    const color = isApproved ? "hsl(142 69% 42%)" : "hsl(0 72% 51%)";
    return (
      <div
        className="rounded-xl p-5 text-center space-y-2"
        style={{
          border: `1px solid ${color}28`,
          background: `${color}08`,
          boxShadow: `0 0 20px -8px ${color}20`,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mx-auto"
          style={{ background: `${color}14`, border: `1px solid ${color}28` }}
        >
          {isApproved
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <XCircle className="w-5 h-5 text-red-400" />
          }
        </div>
        <p className="text-sm font-bold capitalize" style={{ color }}>
          Fix {done}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          LearningAgent is updating vault confidence…
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid hsl(262 83% 65% / 0.22)",
        background: "hsl(262 40% 8% / 0.5)",
        boxShadow: "0 0 24px -8px hsl(262 83% 65% / 0.15)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: "1px solid hsl(262 83% 65% / 0.15)",
          background: "hsl(262 83% 65% / 0.07)",
        }}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-violet-400" />
        <p className="text-xs font-bold text-violet-300 uppercase tracking-[0.08em]">
          Human Approval Required
        </p>
      </div>

      <div className="p-4 space-y-3.5">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Review the fix proposal. Approving applies it and reinforces vault confidence.
          Rejecting decays the confidence of this fix pathway.
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a review note (optional)…"
          rows={2}
          className="w-full text-sm rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none transition-all"
          style={{
            background: "hsl(var(--muted) / 0.5)",
            border: "1px solid hsl(var(--border))",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "hsl(262 83% 65% / 0.4)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px hsl(262 83% 65% / 0.08)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        />

        <div className="flex gap-2">
          <button
            onClick={() => handle("approve")}
            disabled={!!loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-40"
            style={{
              background: "hsl(142 69% 42%)",
              color: "hsl(224 22% 6%)",
              boxShadow: "0 0 16px -4px hsl(142 69% 42% / 0.5)",
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLElement).style.background = "hsl(142 69% 50%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(142 69% 42%)";
            }}
          >
            {loading === "approve"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            Approve & Apply
          </button>
          <button
            onClick={() => handle("reject")}
            disabled={!!loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold py-2.5 px-4 rounded-lg transition-all disabled:opacity-40"
            style={{
              background: "hsl(0 72% 51% / 0.12)",
              border: "1px solid hsl(0 72% 51% / 0.3)",
              color: "hsl(0 72% 65%)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLElement).style.background = "hsl(0 72% 51% / 0.2)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "hsl(0 72% 51% / 0.12)";
            }}
          >
            {loading === "reject"
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <XCircle className="w-3.5 h-3.5" />
            }
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
