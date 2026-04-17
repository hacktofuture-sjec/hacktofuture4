"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, AlertOctagon } from "lucide-react";
import { api } from "@/lib/api-client";

interface Props {
  incidentId: string;
  onResolved: () => void;
}

export function ApprovalPanel({ incidentId, onResolved }: Props) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

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
    return (
      <div className={`border rounded-lg p-4 text-center space-y-1.5
        ${isApproved ? "border-green-400/20 bg-green-400/5" : "border-red-400/20 bg-red-400/5"}`}
      >
        {isApproved
          ? <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
          : <XCircle className="w-5 h-5 text-red-400 mx-auto" />
        }
        <p className={`text-sm font-medium ${isApproved ? "text-green-400" : "text-red-400"}`}>
          Fix {done}
        </p>
        <p className="text-xs text-muted-foreground">
          LearningAgent is updating vault confidence…
        </p>
      </div>
    );
  }

  return (
    <div className="border border-indigo-400/20 bg-indigo-400/5 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-indigo-400/15">
        <AlertOctagon className="w-3.5 h-3.5 text-indigo-400" />
        <p className="text-xs font-medium text-indigo-300">Human Approval Required</p>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This fix requires your review. Approving will apply the fix and update vault confidence.
          Rejecting will decay the confidence of this fix pathway.
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a review note (optional)…"
          rows={2}
          className="w-full text-sm bg-card border border-border rounded-md px-3 py-2
                     text-foreground placeholder:text-muted-foreground resize-none
                     focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <div className="flex gap-2">
          <button
            onClick={() => handle("approve")}
            disabled={!!loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5
                       bg-green-500 hover:bg-green-400 disabled:opacity-40
                       text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
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
            className="flex-1 inline-flex items-center justify-center gap-1.5
                       bg-red-500/15 hover:bg-red-500/25 border border-red-500/30
                       text-red-400 disabled:opacity-40
                       text-sm font-medium py-2 px-4 rounded-md transition-colors"
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
