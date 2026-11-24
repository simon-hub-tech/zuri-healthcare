import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext.jsx";

const roleHome = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome[user.role] || "/login"} replace />;
  }

  return children;
}