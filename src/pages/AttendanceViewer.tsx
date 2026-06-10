import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Download,
  Pencil,
  Trash2,
  RotateCcw,
  CalendarCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchSubject,
  fetchAttendanceLogs,
  markAttendance,
  undoLastAttendance,
  editSubject,
  deleteSubject,
} from "../services/dbService";
import type { Subject, AttendanceLog } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  present: { label: "Present", icon: <CheckCircle2 size={15} />, className: "badge-present" },
  absent: { label: "Absent", icon: <XCircle size={15} />, className: "badge-absent" },
  cancelled: { label: "Cancelled", icon: <MinusCircle size={15} />, className: "badge-cancelled" },
};

const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status.toLowerCase()] ?? {
    label: status,
    icon: <MinusCircle size={15} />,
    className: "badge-cancelled",
  };

const getStatusClass = (pct: number) => {
  if (pct >= 75) return "status-safe";
  if (pct >= 60) return "status-warn";
  return "status-danger";
};

// ── Date formatting ───────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

// ── CSV export ────────────────────────────────────────────────
const downloadCSV = (subject: Subject, logs: AttendanceLog[]) => {
  const header = "Date,Status\n";
  const rows = logs.map((l) => `"${formatDate(l.date)}","${l.status}"`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${subject.code || subject.name}_attendance.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Main component ────────────────────────────────────────────
const AttendanceViewer = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "present" | "absent" | "cancelled">("all");

  // Action states
  const [marking, setMarking] = useState<"present" | "absent" | "cancelled" | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  // ── Load data ───────────────────────────────────────────────
  const reload = async () => {
    if (!user?.email || !subjectId) return;
    const [subjectData, logsData] = await Promise.all([
      fetchSubject(user.email, subjectId),
      fetchAttendanceLogs(user.email, subjectId),
    ]);
    setSubject(subjectData);
    const sorted = logsData.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db2 = new Date(b.date).getTime();
      return isNaN(db2) || isNaN(da) ? 0 : db2 - da;
    });
    setLogs(sorted);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await reload();
      } catch (err) {
        setError("Failed to load attendance data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ─────────────────────────────────────────────────
  const handleMark = async (status: "present" | "absent" | "cancelled") => {
    if (!user?.email || !subjectId) return;
    setMarking(status);
    try {
      await markAttendance(user.email, subjectId, status);
      await reload();
    } finally {
      setMarking(null);
    }
  };

  const handleUndo = async () => {
    if (!user?.email || !subjectId || logs.length === 0) return;
    setUndoing(true);
    try {
      await undoLastAttendance(user.email, subjectId, logs[0]);
      await reload();
    } finally {
      setUndoing(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) { setEditErr("Name is required."); return; }
    setEditSaving(true);
    setEditErr("");
    try {
      await editSubject(user!.email!, subjectId!, { name: editName, code: editCode });
      setEditOpen(false);
      await reload();
    } catch {
      setEditErr("Save failed. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSubject(user!.email!, subjectId!);
      navigate("/subjects", { replace: true });
    } finally {
      setDeleting(false);
    }
  };

  // ── Open edit modal ─────────────────────────────────────────
  const openEdit = () => {
    if (!subject) return;
    setEditName(subject.name);
    setEditCode(subject.code);
    setEditErr("");
    setEditOpen(true);
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) return <LoadingSpinner message="Loading attendance logs…" />;

  if (error || !subject)
    return (
      <div className="error-state">
        <AlertTriangle size={32} />
        <p>{error || "Subject not found."}</p>
        <button className="btn-ghost" onClick={() => navigate("/")}>Go back</button>
      </div>
    );

  const filteredLogs =
    filter === "all" ? logs : logs.filter((l) => l.status.toLowerCase() === filter);

  const presentCount = logs.filter((l) => l.status.toLowerCase() === "present").length;
  const absentCount = logs.filter((l) => l.status.toLowerCase() === "absent").length;
  const cancelledCount = logs.filter((l) => l.status.toLowerCase() === "cancelled").length;

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <button className="btn-ghost btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>

        <div className="subject-header">
          <div>
            <p className="card-code">{subject.code}</p>
            <h1 className="page-title">{subject.name}</h1>
          </div>
          <div className="subject-header-actions">
            <button className="btn-outline btn-icon" onClick={openEdit} title="Edit subject">
              <Pencil size={15} /> Edit
            </button>
            <button
              className="btn-outline btn-outline--danger btn-icon"
              onClick={() => setDeleteOpen(true)}
              title="Delete subject"
            >
              <Trash2 size={15} /> Delete
            </button>
            <button className="btn-outline btn-icon" onClick={() => downloadCSV(subject, logs)} title="Export CSV">
              <Download size={15} /> Export
            </button>
          </div>
        </div>
      </header>

      {/* Summary strip */}
      <div className={`subject-summary ${getStatusClass(subject.percentage)}`}>
        <div className="summary-item">
          <span className="summary-label">Attendance</span>
          <span className="summary-value">{subject.percentage}%</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">Attended</span>
          <span className="summary-value">{subject.attended}</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">Total</span>
          <span className="summary-value">{subject.total}</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">Absent</span>
          <span className="summary-value">{absentCount}</span>
        </div>
        <div className="summary-divider" />
        <div className="summary-item">
          <span className="summary-label">Cancelled</span>
          <span className="summary-value">{cancelledCount}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="detail-progress-bar">
        <div
          className={`detail-progress-fill ${getStatusClass(subject.percentage)}`}
          style={{ width: `${subject.percentage}%` }}
        />
      </div>

      {/* Mark Attendance panel */}
      <section className="mark-panel">
        <div className="mark-panel-header">
          <CalendarCheck size={16} className="mark-panel-icon" />
          <h2 className="mark-panel-title">Mark Today's Attendance</h2>
        </div>
        <div className="mark-btns">
          <button
            id="mark-present-btn"
            className="mark-btn mark-btn--present"
            onClick={() => handleMark("present")}
            disabled={!!marking}
          >
            <CheckCircle2 size={18} />
            {marking === "present" ? "Marking…" : "Present"}
          </button>
          <button
            id="mark-absent-btn"
            className="mark-btn mark-btn--absent"
            onClick={() => handleMark("absent")}
            disabled={!!marking}
          >
            <XCircle size={18} />
            {marking === "absent" ? "Marking…" : "Absent"}
          </button>
          <button
            id="mark-cancelled-btn"
            className="mark-btn mark-btn--cancelled"
            onClick={() => handleMark("cancelled")}
            disabled={!!marking}
          >
            <MinusCircle size={18} />
            {marking === "cancelled" ? "Marking…" : "Cancelled"}
          </button>
          {logs.length > 0 && (
            <button
              id="undo-btn"
              className="mark-btn mark-btn--undo"
              onClick={handleUndo}
              disabled={undoing}
              title={`Undo last entry (${logs[0]?.status})`}
            >
              <RotateCcw size={18} />
              {undoing ? "Undoing…" : "Undo Last"}
            </button>
          )}
        </div>
      </section>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {(["all", "present", "absent", "cancelled"] as const).map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "filter-tab--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? `All (${logs.length})`
              : f === "present"
              ? `Present (${presentCount})`
              : f === "absent"
              ? `Absent (${absentCount})`
              : `Cancelled (${cancelledCount})`}
          </button>
        ))}
      </div>

      {/* Log list */}
      {filteredLogs.length === 0 ? (
        <div className="empty-state">
          <MinusCircle size={36} />
          <p>No records for this filter.</p>
        </div>
      ) : (
        <div className="log-list">
          {filteredLogs.map((log, idx) => {
            const cfg = getStatusConfig(log.status);
            return (
              <div key={log.id} className="log-row">
                <div className="log-left">
                  {idx === 0 && filter === "all" && (
                    <span className="log-latest-badge">Latest</span>
                  )}
                  <span className="log-date">{formatDate(log.date)}</span>
                </div>
                <span className={`badge ${cfg.className}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Subject" size="sm">
        <form onSubmit={handleEdit} className="subject-form">
          <div className="input-group">
            <label className="input-label" htmlFor="edit-name">Subject Name *</label>
            <input
              id="edit-name"
              className="input-field input-field--plain"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="edit-code">Subject Code</label>
            <input
              id="edit-code"
              className="input-field input-field--plain"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
            />
          </div>
          {editErr && <p className="form-error">{editErr}</p>}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-primary--sm" disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Subject" size="sm">
        <div className="confirm-body">
          <p className="confirm-text">
            Are you sure you want to delete <strong>{subject.name}</strong>? All attendance
            records for this subject will be lost.
          </p>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceViewer;
