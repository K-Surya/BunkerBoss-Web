import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="loading-spinner" />
  </div>
);

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
