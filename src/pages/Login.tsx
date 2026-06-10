import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { loginWithEmail, registerWithEmail } from "../services/authService";

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      navigate("/");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong.";
      // Make Firebase errors friendlier
      if (msg.includes("invalid-credential") || msg.includes("wrong-password")) {
        setError("Invalid email or password.");
      } else if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (msg.includes("weak-password")) {
        setError("Password must be at least 6 characters.");
      } else if (msg.includes("user-not-found")) {
        setError("No account found with this email.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="login-logo-text">BunkerBoss</h1>
        </div>

        <p className="login-tagline">Track your attendance, ace your semester.</p>

        {/* Tab switcher */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === "login" ? "login-tab--active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`login-tab ${mode === "register" ? "login-tab--active" : ""}`}
            onClick={() => { setMode("register"); setError(""); }}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {/* Email */}
          <div className="input-group">
            <label className="input-label" htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input-field input-field--padded-right"
                placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="login-error">{error}</p>}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
