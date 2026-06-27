import { useEffect, useState, useCallback } from "react";
import { History, AlertTriangle, CheckCircle2, XCircle, MinusCircle, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchSubjects, fetchAttendanceLogs } from "../services/dbService";
import type { Subject, AttendanceLog } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";

// ── Types ─────────────────────────────────────────────────────
interface HistoryEntry {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  log: AttendanceLog;
  dateObj: Date;
}

// ── Helpers ───────────────────────────────────────────────────
const statusMeta: Record<string, { label: string; className: string; icon: JSX.Element }> = {
  present: {
    label: "Present",
    className: "history-badge history-badge--present",
    icon: <CheckCircle2 size={13} />,
  },
  absent: {
    label: "Absent",
    className: "history-badge history-badge--absent",
    icon: <XCircle size={13} />,
  },
  cancelled: {
    label: "Cancelled",
    className: "history-badge history-badge--cancelled",
    icon: <MinusCircle size={13} />,
  },
};

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

// ── Group entries by date label ───────────────────────────────
const groupByDate = (entries: HistoryEntry[]) => {
  const groups: Record<string, HistoryEntry[]> = {};
  for (const entry of entries) {
    const key = formatDate(entry.dateObj);
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
};

// ── History Page ──────────────────────────────────────────────
const HistoryPage = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const loadAll = useCallback(async () => {
    if (!user?.email) return;
    const subjects: Subject[] = await fetchSubjects(user.email);

    const allEntries: HistoryEntry[] = [];

    await Promise.all(
      subjects.map(async (subject) => {
        try {
          const logs = await fetchAttendanceLogs(user.email!, subject.id);
          for (const log of logs) {
            // Try ISO string first, then fall back to raw value
            const dateObj = new Date(log.date);
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid date for log ${log.id} in subject ${subject.name}:`, log.date);
              continue;
            }
            allEntries.push({
              subjectId: subject.id,
              subjectName: subject.name,
              subjectCode: subject.code,
              log,
              dateObj,
            });
          }
        } catch (err) {
          console.error(`Failed to load logs for subject "${subject.name}":`, err);
        }
      })
    );

    console.log(`History: loaded ${allEntries.length} total entries from ${subjects.length} subjects`);

    // Sort newest first
    allEntries.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    setEntries(allEntries);
  }, [user]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadAll();
      } catch {
        setError("Failed to load history. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [loadAll]);

  if (loading) return <LoadingSpinner message="Loading attendance history…" />;

  if (error)
    return (
      <div className="error-state">
        <AlertTriangle size={32} />
        <p>{error}</p>
      </div>
    );

  // ── Filter ──────────────────────────────────────────────────
  const filtered = entries.filter((e) => {
    const matchSearch =
      e.subjectName.toLowerCase().includes(search.toLowerCase()) ||
      e.subjectCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.log.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const grouped = groupByDate(filtered);
  const dateKeys = Object.keys(grouped);

  return (
    <div className="page">
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">
            {entries.length} total entries across all subjects — newest first.
          </p>
        </div>
      </header>

      {/* Controls */}
      <div className="history-controls">
        <div className="search-bar-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="search"
            className="search-bar search-bar--icon"
            placeholder="Search by subject name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {["all", "present", "absent", "cancelled"].map((s) => (
            <button
              key={s}
              className={`filter-tab ${filterStatus === s ? "filter-tab--active" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <History size={40} />
          <p>{entries.length === 0 ? "No attendance has been recorded yet." : "No entries match your search."}</p>
        </div>
      ) : (
        <div className="history-feed">
          {dateKeys.map((dateKey) => (
            <div key={dateKey} className="history-group">
              <div className="history-date-header">
                <span className="history-date-label">{dateKey}</span>
                <span className="history-date-count">{grouped[dateKey].length} entries</span>
              </div>

              <div className="history-list">
                {grouped[dateKey].map((entry) => {
                  const meta = statusMeta[entry.log.status] ?? {
                    label: entry.log.status,
                    className: "history-badge",
                    icon: null,
                  };
                  return (
                    <div key={entry.log.id} className="history-row">
                      <div className="history-row-left">
                        <span className={meta.className}>
                          {meta.icon}
                          {meta.label}
                        </span>
                        <div className="history-subject">
                          <span className="history-subject-code">{entry.subjectCode || entry.subjectName}</span>
                          <span className="history-subject-name">{entry.subjectName}</span>
                        </div>
                      </div>
                      <span className="history-time">{formatTime(entry.dateObj)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
