import { Navigate, Route, Routes } from "react-router";
import { LoginPage, RegisterPage } from "./AuthPages.jsx";
import { useAuth } from "./AuthContext.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import DoctorDashboard from "./DoctorDashboard.jsx";
import PatientDashboard from "./PatientDashboard.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

const roleHome = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome[user.role] : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/patient"
        element={
          <ProtectedRoute allowedRoles={["patient"]}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={["doctor"]}>
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}