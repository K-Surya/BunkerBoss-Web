import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import type { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar whenever the route changes (mobile nav click)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add("sidebar-body-lock");
    } else {
      document.body.classList.remove("sidebar-body-lock");
    }
    return () => document.body.classList.remove("sidebar-body-lock");
  }, [sidebarOpen]);

  return (
    <div className="layout">
      {/* Mobile top bar */}
      <header className="topbar">
        <button
          className="topbar-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="topbar-title">BunkerBoss</span>
      </header>

      {/* Backdrop (mobile only, when sidebar open) */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="layout-main">
        <div className="layout-content">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
