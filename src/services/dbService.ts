import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  increment,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import type { Subject, AttendanceLog, UserProfile } from "../types";

// ── Helpers ──────────────────────────────────────────────────

const parseSubject = (docSnap: { id: string; data: () => Record<string, unknown> }): Subject => {
  const data = docSnap.data();
  const attended = Number(data.attended ?? 0);
  const total = Number(data.total ?? 0);
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
  return {
    id: docSnap.id,
    name: String(data.name ?? ""),
    code: String(data.code ?? ""),
    attended,
    total,
    percentage,
    active: data.active !== false, // defaults to true for existing docs
  };
};

// ── READ ─────────────────────────────────────────────────────

export const fetchSubjects = async (email: string): Promise<Subject[]> => {
  const subjectsRef = collection(db, "users", email, "subjects");
  const snapshot = await getDocs(subjectsRef);
  return snapshot.docs.map(parseSubject);
};

export const fetchSubject = async (
  email: string,
  subjectId: string
): Promise<Subject | null> => {
  const docRef = doc(db, "users", email, "subjects", subjectId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return parseSubject(docSnap);
};

export const fetchAttendanceLogs = async (
  email: string,
  subjectId: string
): Promise<AttendanceLog[]> => {
  const logsRef = collection(db, "users", email, "subjects", subjectId, "attendance log");
  const snapshot = await getDocs(logsRef);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    let date = data.date ?? "";
    if (date instanceof Timestamp) {
      date = date.toDate().toISOString();
    }
    return {
      id: docSnap.id,
      date: String(date),
      status: String(data.status ?? ""),
      ...data,
    } as AttendanceLog;
  });
};

// ── CREATE / UPDATE ──────────────────────────────────────────

/** Add a brand-new subject (auto-generates Firestore ID) */
export const addSubject = async (
  email: string,
  data: { name: string; code: string }
): Promise<string> => {
  const subjectsRef = collection(db, "users", email, "subjects");
  const docRef = await addDoc(subjectsRef, {
    name: data.name.trim(),
    code: data.code.trim(),
    attended: 0,
    total: 0,
  });
  return docRef.id;
};

/** Edit a subject's name and/or code */
export const editSubject = async (
  email: string,
  subjectId: string,
  data: { name: string; code: string }
): Promise<void> => {
  const docRef = doc(db, "users", email, "subjects", subjectId);
  await updateDoc(docRef, {
    name: data.name.trim(),
    code: data.code.trim(),
  });
};

/**
 * Mark attendance for a subject.
 *
 * present   → attended++, total++, log entry with status "present"
 * absent    → total only++, log entry with status "absent"
 * cancelled → no count change, log entry with status "cancelled"
 */
export const markAttendance = async (
  email: string,
  subjectId: string,
  status: "present" | "absent" | "cancelled",
  date: Date = new Date()
): Promise<void> => {
  const subjectRef = doc(db, "users", email, "subjects", subjectId);
  const logRef = collection(db, "users", email, "subjects", subjectId, "attendance log");

  // Build Firestore update
  const countUpdate: Record<string, unknown> = {};
  if (status === "present") {
    countUpdate.attended = increment(1);
    countUpdate.total = increment(1);
  } else if (status === "absent") {
    countUpdate.total = increment(1);
  }
  // cancelled → no counter change

  // Write both atomically (best-effort; Firestore batch could be used for strict atomicity)
  const promises: Promise<unknown>[] = [
    addDoc(logRef, {
      date: Timestamp.fromDate(date),
      status,
    }),
  ];

  if (Object.keys(countUpdate).length > 0) {
    promises.push(updateDoc(subjectRef, countUpdate));
  }

  await Promise.all(promises);
};

/**
 * Undo the last attendance log entry for a subject.
 * Deletes the most recent log doc and reverses the counter.
 */
export const undoLastAttendance = async (
  email: string,
  subjectId: string,
  log: AttendanceLog
): Promise<void> => {
  const logDocRef = doc(
    db,
    "users",
    email,
    "subjects",
    subjectId,
    "attendance log",
    log.id
  );
  const subjectRef = doc(db, "users", email, "subjects", subjectId);

  const countUpdate: Record<string, unknown> = {};
  if (log.status === "present") {
    countUpdate.attended = increment(-1);
    countUpdate.total = increment(-1);
  } else if (log.status === "absent") {
    countUpdate.total = increment(-1);
  }

  const promises: Promise<unknown>[] = [deleteDoc(logDocRef)];
  if (Object.keys(countUpdate).length > 0) {
    promises.push(updateDoc(subjectRef, countUpdate));
  }
  await Promise.all(promises);
};

// ── FREEZE / REACTIVATE ──────────────────────────────────────

/** Freeze a subject — sets active=false, attendance can no longer be marked */
export const freezeSubject = async (
  email: string,
  subjectId: string
): Promise<void> => {
  const docRef = doc(db, "users", email, "subjects", subjectId);
  await updateDoc(docRef, { active: false });
};

/** Reactivate a frozen subject — sets active=true */
export const reactivateSubject = async (
  email: string,
  subjectId: string
): Promise<void> => {
  const docRef = doc(db, "users", email, "subjects", subjectId);
  await updateDoc(docRef, { active: true });
};

// ── DELETE ───────────────────────────────────────────────────

/** Delete a subject and its user document entry (does NOT cascade sub-collections on the client) */
export const deleteSubject = async (
  email: string,
  subjectId: string
): Promise<void> => {
  // Note: Firestore SDK doesn't cascade-delete sub-collections from the client.
  // The attendance logs sub-collection will be orphaned but the subject document is removed.
  const docRef = doc(db, "users", email, "subjects", subjectId);
  await deleteDoc(docRef);
};

/** Ensure user document exists (for new registrations) */
export const ensureUserDocument = async (email: string): Promise<void> => {
  const userRef = doc(db, "users", email);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { email, createdAt: Timestamp.now() });
  }
};

/** Fetch user document fields */
export const fetchUserProfile = async (email: string): Promise<UserProfile | null> => {
  const userRef = doc(db, "users", email);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { email, ...snap.data() } as UserProfile;
};
