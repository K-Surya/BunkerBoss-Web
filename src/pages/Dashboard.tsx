import { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchSubjects,
  fetchSubject,
  fetchAttendanceLogs,
  markAttendance,
  undoLastAttendance,
  addSubject,
  editSubject,
  deleteSubject,
} from "../services/dbService";
import type { Subject, AttendanceLog } from "../types";
import AttendanceCard from "../components/AttendanceCard";
import StatsCard from "../components/StatsCard";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Latest log cache: subjectId → most recent AttendanceLog
type LogCache = Record<string, AttendanceLog | undefined>;

// ── SubjectForm ───────────────────────────────────────────────
interface SubjectFormProps {
  initial?: { name: string; code: string };
  onSubmit: (d: { name: string; code: string }) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

const SubjectForm = ({
  initial = { name: "", code: "" },
  onSubmit,
  onCancel,
  submitLabel,
}: SubjectFormProps) => {
  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("Subject name is required."); return; }
    setSaving(true);
    setErr("");
    try { await onSubmit({ name, code }); }
    catch { setErr("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="subject-form">
      <div className="input-group">
        <label className="input-label" htmlFor="sf-name">Subject Name *</label>
        <input
          id="sf-name"
          className="input-field input-field--plain"
          placeholder="e.g. Mathematics"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="sf-code">Subject Code</label>
        <input
          id="sf-code"
          className="input-field input-field--plain"
          placeholder="e.g. MA101"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {err && <p className="form-error">{err}</p>}
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary btn-primary--sm" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
};

// ── Dashboard ─────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logCache, setLogCache] = useState<LogCache>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load all subjects + their latest log ──────────────────
  const loadAll = useCallback(async () => {
    if (!user?.email) return;
    const data = await fetchSubjects(user.email);
    // Only keep active subjects for the dashboard
    const active = data.filter((s) => s.active);
    setSubjects(active);

    // Fetch latest log for each active subject in parallel
    const entries = await Promise.all(
      active.map(async (s) => {
        try {
          const logs = await fetchAttendanceLogs(user.email!, s.id);
          const sorted = logs.sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db2 = new Date(b.date).getTime();
            return isNaN(db2) || isNaN(da) ? 0 : db2 - da;
          });
          return [s.id, sorted[0]] as [string, AttendanceLog | undefined];
        } catch {
          return [s.id, undefined] as [string, undefined];
        }
      })
    );
    setLogCache(Object.fromEntries(entries));
  }, [user]);

  useEffect(() => {
    const run = async () => {
      try { await loadAll(); }
      catch { setError("Failed to load subjects. Please try again."); }
      finally { setLoading(false); }
    };
    run();
  }, [loadAll]);

  // ── Mark attendance for one subject ──────────────────────
  const handleMark = async (
    subjectId: string,
    status: "present" | "absent" | "cancelled"
  ) => {
    if (!user?.email) return;
    await markAttendance(user.email, subjectId, status);
    // Refresh just that subject's data
    const [updated, logs] = await Promise.all([
      fetchSubject(user.email, subjectId),
      fetchAttendanceLogs(user.email, subjectId),
    ]);
    if (updated) {
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? updated : s))
      );
    }
    const sorted = logs.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db2 = new Date(b.date).getTime();
      return isNaN(db2) || isNaN(da) ? 0 : db2 - da;
    });
    setLogCache((prev) => ({ ...prev, [subjectId]: sorted[0] }));
  };

  // ── Undo last for one subject ─────────────────────────────
  const handleUndo = async (subjectId: string) => {
    if (!user?.email) return;
    const latest = logCache[subjectId];
    if (!latest) return;
    await undoLastAttendance(user.email, subjectId, latest);
    const [updated, logs] = await Promise.all([
      fetchSubject(user.email, subjectId),
      fetchAttendanceLogs(user.email, subjectId),
    ]);
    if (updated) {
      setSubjects((prev) =>
        prev.map((s) => (s.id === subjectId ? updated : s))
      );
    }
    const sorted = logs.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db2 = new Date(b.date).getTime();
      return isNaN(db2) || isNaN(da) ? 0 : db2 - da;
    });
    setLogCache((prev) => ({ ...prev, [subjectId]: sorted[0] }));
  };

  // ── CRUD handlers ────────────────────────────────────────
  const handleAdd = async (data: { name: string; code: string }) => {
    await addSubject(user!.email!, data);
    setAddOpen(false);
    await loadAll();
  };

  const handleEdit = async (data: { name: string; code: string }) => {
    await editSubject(user!.email!, editTarget!.id, data);
    setEditTarget(null);
    await loadAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSubject(user!.email!, deleteTarget.id);
      setDeleteTarget(null);
      await loadAll();
    } finally {
      setDeleting(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────
  if (loading) return <LoadingSpinner message="Loading your attendance…" />;

  if (error)
    return (
      <div className="error-state">
        <AlertTriangle size={32} />
        <p>{error}</p>
      </div>
    );

  // ── Derived stats ─────────────────────────────────────────
  const totalSubjects = subjects.length;
  const safeSubjects = subjects.filter((s) => s.percentage >= 75).length;
  const atRisk = subjects.filter((s) => s.percentage < 75 && s.percentage >= 60).length;
  const critical = subjects.filter((s) => s.percentage < 60).length;
  const overallPct =
    totalSubjects > 0
      ? Math.round(subjects.reduce((sum, s) => sum + s.percentage, 0) / totalSubjects)
      : 0;

  const radarData = subjects.map((s) => ({
    subject: s.code || s.name,
    percentage: s.percentage,
  }));

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header page-header--row">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Hello, {user?.email?.split("@")[0]} 👋 — mark today's attendance below.
          </p>
        </div>
        <button
          id="dashboard-add-subject"
          className="btn-primary btn-primary--sm btn-icon"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} />
          Add Subject
        </button>
      </header>

      {/* Stats row */}
      <div className="stats-grid">
        <StatsCard
          label="Total Subjects"
          value={totalSubjects}
          icon={<BookOpen size={20} />}
          accent="blue"
        />
        <StatsCard
          label="Overall Attendance"
          value={`${overallPct}%`}
          sub="across all subjects"
          icon={<BarChart3 size={20} />}
          accent="blue"
        />
        <StatsCard
          label="Safe (≥75%)"
          value={safeSubjects}
          icon={<CheckCircle size={20} />}
          accent="green"
        />
        <StatsCard
          label="At Risk (60–74%)"
          value={atRisk}
          icon={<AlertTriangle size={20} />}
          accent="amber"
        />
        <StatsCard
          label="Critical (<60%)"
          value={critical}
          icon={<XCircle size={20} />}
          accent="red"
        />
      </div>

      {/* Subjects + radar */}
      <div className="dashboard-grid">
        <section className="section">
          <h2 className="section-title">Subjects</h2>
          {subjects.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={40} />
              <p>No active subjects. Add one or check the Subjects tab for frozen ones.</p>
              <button className="btn-primary btn-primary--sm" onClick={() => setAddOpen(true)}>
                <Plus size={15} /> Add Subject
              </button>
            </div>
          ) : (
            <div className="cards-grid">
              {subjects.map((subject) => (
                <div key={subject.id} className="card-wrapper">
                  <AttendanceCard
                    subject={subject}
                    onMark={handleMark}
                    latestStatus={logCache[subject.id]?.status}
                    onUndo={handleUndo}
                  />
                  {/* Edit / Delete overlay */}
                  <div className="card-actions">
                    <button
                      className="card-action-btn"
                      title="Edit subject"
                      onClick={() => setEditTarget(subject)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="card-action-btn card-action-btn--danger"
                      title="Delete subject"
                      onClick={() => setDeleteTarget(subject)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Radar chart */}
        {subjects.length > 0 && (
          <section className="section">
            <h2 className="section-title">Attendance Radar</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Radar
                    name="Attendance"
                    dataKey="percentage"
                    stroke="#4f46e5"
                    fill="#4f46e5"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Attendance"]}
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>

      {/* Add modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Subject" size="sm">
        <SubjectForm
          onSubmit={handleAdd}
          onCancel={() => setAddOpen(false)}
          submitLabel="Add Subject"
        />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Subject" size="sm">
        {editTarget && (
          <SubjectForm
            initial={{ name: editTarget.name, code: editTarget.code }}
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Subject" size="sm">
        {deleteTarget && (
          <div className="confirm-body">
            <p className="confirm-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>
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
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
