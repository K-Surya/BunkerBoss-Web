export interface Subject {
  id: string;
  name: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
  active: boolean;
}

export interface AttendanceLog {
  id: string;
  date: string;       // ISO date string or Firestore Timestamp
  status: string;     // "present" | "absent" | "cancelled" | etc.
  [key: string]: unknown;
}

export interface UserProfile {
  email: string;
  id?: number;
  name?: string;
  reg?: number;
  department?: string;
}
