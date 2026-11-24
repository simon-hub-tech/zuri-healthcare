import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext.jsx";
import { apiRequest } from "./api.js";

function formatAppointmentTime(value) {
  return new Date(value).toLocaleString();
}

export default function DoctorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyAppointmentId, setBusyAppointmentId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/doctor/appointments", { token });
      setAppointments(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  async function updateStatus(appointmentId, status) {
    setBusyAppointmentId(appointmentId);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/doctor/appointments/${appointmentId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });

      setNotice(`Appointment ${status}.`);
      await loadAppointments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Doctor dashboard</p>
          <h1>Welcome, {user?.fullName}</h1>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={handleLogout}
        >
          Sign out
        </button>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Assigned appointments</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={loadAppointments}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p>No appointments are assigned to you yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Date and time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.patientName}</td>
                    <td>
                      <div>{appointment.patientEmail}</div>
                      <div>{appointment.patientPhone || "No phone listed"}</div>
                    </td>
                    <td>{formatAppointmentTime(appointment.appointmentAt)}</td>
                    <td>{appointment.reason}</td>
                    <td>
                      <span
                        className={`status-badge status-${appointment.status}`}
                      >
                        {appointment.status}
                      </span>
                    </td>
                    <td>
                      {appointment.status === "pending" ? (
                        <div className="action-buttons">
                          <button
                            type="button"
                            onClick={() =>
                              updateStatus(appointment.id, "approved")
                            }
                            disabled={busyAppointmentId === appointment.id}
                          >
                            {busyAppointmentId === appointment.id
                              ? "Saving…"
                              : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() =>
                              updateStatus(appointment.id, "declined")
                            }
                            disabled={busyAppointmentId === appointment.id}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span>Decision recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}