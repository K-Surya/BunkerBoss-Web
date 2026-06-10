import { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, RotateCcw, Lock } from "lucide-react";
import type { Subject } from "../types";

interface AttendanceCardProps {
  subject: Subject;
  onMark?: (
    subjectId: string,
    status: "present" | "absent" | "cancelled"
  ) => Promise<void>;
  latestStatus?: string;
  onUndo?: (subjectId: string) => Promise<void>;
  /** When true, the card renders in a frozen/inactive state */
  frozen?: boolean;
}

const getStatusClass = (pct: number) => {
  if (pct >= 75) return "status-safe";
  if (pct >= 60) return "status-warn";
  return "status-danger";
};

const AttendanceCard = ({
  subject,
  onMark,
  latestStatus,
  onUndo,
  frozen = false,
}: AttendanceCardProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  const statusClass = frozen ? "status-frozen" : getStatusClass(subject.percentage);

  const handle = async (status: "present" | "absent" | "cancelled") => {
    if (!onMark || frozen) return;
    setBusy(status);
    try {
      await onMark(subject.id, status);
    } finally {
      setBusy(null);
    }
  };

  const handleUndo = async () => {
    if (!onUndo || frozen) return;
    setBusy("undo");
    try {
      await onUndo(subject.id);
    } finally {
      setBusy(null);
    }
  };

  const isLoading = busy !== null;

  return (
    <article className={`attendance-card ${statusClass}`}>
      {/* Frozen badge */}
      {frozen && (
        <div className="card-frozen-badge">
          <Lock size={12} />
          <span>Frozen</span>
        </div>
      )}

      {/* Top: code + name */}
      <div className="card-top">
        <p className="card-code">{subject.code}</p>
        <h3 className="card-name">{subject.name}</h3>
      </div>

      {/* Progress bar */}
      <div className="card-progress-bar">
        <div
          className="card-progress-fill"
          style={{ width: `${subject.percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="card-stats">
        <span className="card-pct">{subject.percentage}%</span>
        <span className="card-counts">
          {subject.attended} / {subject.total} classes
        </span>
      </div>

      {/* Mark buttons — hidden when frozen */}
      {!frozen && onMark && (
        <>
          <div className="card-divider" />
          <div className="card-mark-row">
            <button
              className="card-mark-btn card-mark-btn--present"
              onClick={() => handle("present")}
              disabled={isLoading}
              title="Mark Present"
            >
              <CheckCircle2 size={14} />
              {busy === "present" ? "…" : "Present"}
            </button>
            <button
              className="card-mark-btn card-mark-btn--absent"
              onClick={() => handle("absent")}
              disabled={isLoading}
              title="Mark Absent"
            >
              <XCircle size={14} />
              {busy === "absent" ? "…" : "Absent"}
            </button>
            <button
              className="card-mark-btn card-mark-btn--cancelled"
              onClick={() => handle("cancelled")}
              disabled={isLoading}
              title="Mark Cancelled"
            >
              <MinusCircle size={14} />
              {busy === "cancelled" ? "…" : "Cancel"}
            </button>
            {latestStatus && onUndo && (
              <button
                className="card-mark-btn card-mark-btn--undo"
                onClick={handleUndo}
                disabled={isLoading}
                title={`Undo last (${latestStatus})`}
              >
                <RotateCcw size={14} />
                {busy === "undo" ? "…" : "Undo"}
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
};

export default AttendanceCard;
