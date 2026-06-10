import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, LogOut, GraduationCap, X } from "lucide-react";
import { logout } from "../services/authService";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      {/* Close button (visible on mobile only) */}
      <button
        className="sidebar-close"
        onClick={onClose}
        aria-label="Close menu"
      >
        <X size={20} />
      </button>

      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <GraduationCap size={22} />
        </div>
        <span className="sidebar-logo-text">BunkerBoss</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "sidebar-link--active" : ""}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `sidebar-user sidebar-user--link ${isActive ? "sidebar-user--active" : ""}`
          }
          title="View Profile"
        >
          <div className="sidebar-avatar">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">My Profile</p>
            <p className="sidebar-user-email">{user?.email}</p>
          </div>
        </NavLink>

        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
