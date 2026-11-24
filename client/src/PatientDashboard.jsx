import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext.jsx";
import { apiRequest } from "./api.js";

function localDateTimeMinimum() {
  const minimum = new Date(Date.now() + 60_000);
  const localTime = new Date(
    minimum.getTime() - minimum.getTimezoneOffset() * 60_000,
  );

  return localTime.toISOString().slice(0, 16);
}

function formatAppointmentTime(value) {
  return new Date(value).toLocaleString();
}

export default function PatientDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState({
    doctorId: "",
    appointmentAt: "",
    reason: "",
  });
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [doctorResponse, appointmentResponse] = await Promise.all([
        apiRequest("/doctors"),
        apiRequest("/appointments/my", { token }),
      ]);

      setDoctors(doctorResponse.data);
      setAppointments(appointmentResponse.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleBooking(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsBooking(true);

    try {
      await apiRequest("/appointments", {
        method: "POST",
        token,
        body: JSON.stringify({
          doctorId: Number(form.doctorId),
          appointmentAt: form.appointmentAt,
          reason: form.reason,
        }),
      });

      setForm({ doctorId: "", appointmentAt: "", reason: "" });
      setNotice("Appointment request sent.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBooking(false);
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
          <p className="eyebrow">Patient dashboard</p>
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
        <h2>Book an appointment</h2>
        {doctors.length === 0 && !loading ? (
          <p>No available doctors are listed yet.</p>
        ) : (
          <form className="dashboard-form" onSubmit={handleBooking}>
            <label htmlFor="appointment-doctor">Doctor</label>
            <select
              id="appointment-doctor"
              value={form.doctorId}
              onChange={(event) =>
                setForm({ ...form, doctorId: event.target.value })
              }
              required
            >
              <option value="">Choose a doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName} — {doctor.specialty}
                </option>
              ))}
            </select>

            <label htmlFor="appointment-time">Date and time</label>
            <input
              id="appointment-time"
              type="datetime-local"
              min={localDateTimeMinimum()}
              value={form.appointmentAt}
              onChange={(event) =>
                setForm({ ...form, appointmentAt: event.target.value })
              }
              required
            />

            <label htmlFor="appointment-reason">Reason for visit</label>
            <textarea
              id="appointment-reason"
              rows={3}
              maxLength={1000}
              value={form.reason}
              onChange={(event) =>
                setForm({ ...form, reason: event.target.value })
              }
              required
            />

            <button type="submit" disabled={isBooking || doctors.length === 0}>
              {isBooking ? "Sending request…" : "Request appointment"}
            </button>
          </form>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>My appointments</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading appointments…</p>
        ) : appointments.length === 0 ? (
          <p>You have no appointments yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Date and time</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.doctorName}</td>
                    <td>{appointment.doctorSpecialty}</td>
                    <td>{formatAppointmentTime(appointment.appointmentAt)}</td>
                    <td>{appointment.reason}</td>
                    <td>
                      <span
                        className={`status-badge status-${appointment.status}`}
                      >
                        {appointment.status}
                      </span>
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