export interface Subject {
  id: string;
  name: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
}

export interface AttendanceLog {
  id: string;
  date: string;       // ISO date string or Firestore Timestamp
  status: string;     // "present" | "absent" | "cancelled" | etc.
  [key: string]: unknown;
}

export interface UserProfile {
  email: string;
  displayName?: string;
}
