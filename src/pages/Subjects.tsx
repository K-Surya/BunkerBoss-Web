import { useEffect, useState, useCallback } from "react";
import { BookOpen, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";
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
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";

type LogCache = Record<string, AttendanceLog | undefined>;

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
        <label className="input-label" htmlFor="sf2-name">Subject Name *</label>
        <input
          id="sf2-name"
          className="input-field input-field--plain"
          placeholder="e.g. Mathematics"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="sf2-code">Subject Code</label>
        <input
          id="sf2-code"
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

const Subjects = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [logCache, setLogCache] = useState<LogCache>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user?.email) return;
    const data = await fetchSubjects(user.email);
    data.sort((a, b) => a.percentage - b.percentage);
    setSubjects(data);

    const entries = await Promise.all(
      data.map(async (s) => {
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
      catch { setError("Failed to load subjects."); }
      finally { setLoading(false); }
    };
    run();
  }, [loadAll]);

  const handleMark = async (subjectId: string, status: "present" | "absent" | "cancelled") => {
    if (!user?.email) return;
    await markAttendance(user.email, subjectId, status);
    const [updated, logs] = await Promise.all([
      fetchSubject(user.email, subjectId),
      fetchAttendanceLogs(user.email, subjectId),
    ]);
    if (updated) setSubjects((prev) => prev.map((s) => (s.id === subjectId ? updated : s)));
    const sorted = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLogCache((prev) => ({ ...prev, [subjectId]: sorted[0] }));
  };

  const handleUndo = async (subjectId: string) => {
    if (!user?.email) return;
    const latest = logCache[subjectId];
    if (!latest) return;
    await undoLastAttendance(user.email, subjectId, latest);
    const [updated, logs] = await Promise.all([
      fetchSubject(user.email, subjectId),
      fetchAttendanceLogs(user.email, subjectId),
    ]);
    if (updated) setSubjects((prev) => prev.map((s) => (s.id === subjectId ? updated : s)));
    const sorted = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLogCache((prev) => ({ ...prev, [subjectId]: sorted[0] }));
  };

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

  if (loading) return <LoadingSpinner message="Loading subjects…" />;

  if (error)
    return (
      <div className="error-state">
        <AlertTriangle size={32} />
        <p>{error}</p>
      </div>
    );

  const filtered = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <header className="page-header page-header--row">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} — sorted by lowest attendance first.
          </p>
        </div>
        <button
          id="subjects-add-btn"
          className="btn-primary btn-primary--sm btn-icon"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} />
          Add Subject
        </button>
      </header>

      <div className="search-bar-wrapper">
        <input
          type="search"
          className="search-bar"
          placeholder="Search by subject name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {subjects.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} />
          <p>No subjects yet. Add your first one!</p>
          <button className="btn-primary btn-primary--sm" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add Subject
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={40} />
          <p>No subjects match your search.</p>
        </div>
      ) : (
        <div className="cards-grid cards-grid--wide">
          {filtered.map((subject) => (
            <div key={subject.id} className="card-wrapper">
              <AttendanceCard
                subject={subject}
                onMark={handleMark}
                latestStatus={logCache[subject.id]?.status}
                onUndo={handleUndo}
              />
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

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Subject" size="sm">
        <SubjectForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} submitLabel="Add Subject" />
      </Modal>

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

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Subject" size="sm">
        {deleteTarget && (
          <div className="confirm-body">
            <p className="confirm-text">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Subjects;
