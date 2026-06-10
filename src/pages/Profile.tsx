import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Hash,
  Building2,
  BadgeCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { logout } from "../services/authService";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { fetchUserProfile } from "../services/dbService";
import type { UserProfile } from "../types";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Change password state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [dbUser, setDbUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user?.email) {
      fetchUserProfile(user.email).then(setDbUser).catch(console.error);
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess(false);

    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("Passwords do not match.");
      return;
    }

    setPwdLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !user?.email) throw new Error("Not authenticated.");

      // Re-authenticate first (required by Firebase for sensitive operations)
      const credential = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPwd);

      setPwdSuccess(true);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setPwdError("Current password is incorrect.");
      } else {
        setPwdError(msg);
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "U";
  const joinedDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-ghost btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="page-title">Profile</h1>
      </header>

      <div className="profile-grid">
        {/* Left column */}
        <div className="profile-left">
          {/* Identity card */}
          <div className="profile-card">
            <div className="profile-avatar-lg">{initial}</div>
            <div className="profile-info">
              <div className="profile-info-row">
                <Mail size={15} className="profile-info-icon" />
                <span className="profile-info-value">{user?.email}</span>
              </div>
              {joinedDate && (
                <div className="profile-info-row">
                  <User size={15} className="profile-info-icon" />
                  <span className="profile-info-value">Member since {joinedDate}</span>
                </div>
              )}
              <div className="profile-info-row">
                <ShieldCheck size={15} className="profile-info-icon" />
                <span className="profile-info-value">Email / Password account</span>
              </div>
            </div>
          </div>

          {dbUser && (
            <div className="profile-card">
              <div className="profile-info">
                <div className="profile-info-row">
                  <User size={15} className="profile-info-icon" />
                  <span className="profile-info-value"><strong>Name:</strong> {dbUser.name || "N/A"}</span>
                </div>
                <div className="profile-info-row">
                  <Hash size={15} className="profile-info-icon" />
                  <span className="profile-info-value"><strong>Id Number:</strong> {dbUser.id || "N/A"}</span>
                </div>
                <div className="profile-info-row">
                  <BadgeCheck size={15} className="profile-info-icon" />
                  <span className="profile-info-value"><strong>Registration Number:</strong> {dbUser.reg || "N/A"}</span>
                </div>
                <div className="profile-info-row">
                  <Building2 size={15} className="profile-info-icon" />
                  <span className="profile-info-value"><strong>Department:</strong> {dbUser.department || "N/A"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button className="btn-danger btn-full" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>

        {/* Right column */}
        <div className="profile-right">
          <div className="profile-card">
            <div className="profile-card-header">
              <Lock size={18} />
              <h2 className="profile-card-title">Change Password</h2>
            </div>

            <form onSubmit={handleChangePassword} className="subject-form" noValidate>
              <div className="input-group">
                <label className="input-label" htmlFor="current-pwd">Current Password</label>
                <input
                  id="current-pwd"
                  type="password"
                  className="input-field input-field--plain"
                  placeholder="Your current password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="new-pwd">New Password</label>
                <input
                  id="new-pwd"
                  type="password"
                  className="input-field input-field--plain"
                  placeholder="Min. 6 characters"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="confirm-pwd">Confirm New Password</label>
                <input
                  id="confirm-pwd"
                  type="password"
                  className="input-field input-field--plain"
                  placeholder="Repeat new password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {pwdError && (
                <div className="form-feedback form-feedback--error">
                  <AlertTriangle size={14} />
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div className="form-feedback form-feedback--success">
                  <CheckCircle2 size={14} />
                  Password changed successfully!
                </div>
              )}

              <button
                type="submit"
                className="btn-primary btn-primary--sm"
                disabled={pwdLoading}
              >
                {pwdLoading ? "Updating…" : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
