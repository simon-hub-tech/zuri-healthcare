import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext.jsx";
import { apiRequest } from "./api.js";

const emptyPatientForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
};

const emptyDoctorForm = {
  fullName: "",
  email: "",
  password: "",
  specialty: "",
  phone: "",
  bio: "",
  isAvailable: "true",
};

function TextField({ label, ...props }) {
  const id = props.id || props.name;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  );
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function dateForInput(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("patients");
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [doctorForm, setDoctorForm] = useState(emptyDoctorForm);
  const [editingPatientId, setEditingPatientId] = useState(null);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [patientResponse, doctorResponse, appointmentResponse] =
        await Promise.all([
          apiRequest("/admin/patients", { token }),
          apiRequest("/admin/doctors", { token }),
          apiRequest("/admin/appointments", { token }),
        ]);

      setPatients(patientResponse.data);
      setDoctors(doctorResponse.data);
      setAppointments(appointmentResponse.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function startEditingPatient(patient) {
    setEditingPatientId(patient.id);
    setPatientForm({
      fullName: patient.fullName || "",
      email: patient.email || "",
      password: "",
      phone: patient.phone || "",
      dateOfBirth: dateForInput(patient.dateOfBirth),
      gender: patient.gender || "",
      address: patient.address || "",
    });
    setError("");
    setNotice("");
  }

  function cancelPatientEdit() {
    setEditingPatientId(null);
    setPatientForm(emptyPatientForm);
  }

  async function savePatient(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = {
        ...patientForm,
        dateOfBirth: patientForm.dateOfBirth || null,
      };

      if (editingPatientId !== null) {
        await apiRequest(`/admin/patients/${editingPatientId}`, {
          method: "PUT",
          token,
          body: JSON.stringify(body),
        });
        setNotice("Patient updated.");
      } else {
        await apiRequest("/admin/patients", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        setNotice("Patient added.");
      }

      cancelPatientEdit();
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePatient(patient) {
    if (!window.confirm(`Delete patient ${patient.fullName}?`)) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(`/admin/patients/${patient.id}`, {
        method: "DELETE",
        token,
      });
      setNotice("Patient deleted.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function startEditingDoctor(doctor) {
    setEditingDoctorId(doctor.id);
    setDoctorForm({
      fullName: doctor.fullName || "",
      email: doctor.email || "",
      password: "",
      specialty: doctor.specialty || "",
      phone: doctor.phone || "",
      bio: doctor.bio || "",
      isAvailable: doctor.isAvailable ? "true" : "false",
    });
    setError("");
    setNotice("");
  }

  function cancelDoctorEdit() {
    setEditingDoctorId(null);
    setDoctorForm(emptyDoctorForm);
  }

  async function saveDoctor(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const body = {
        ...doctorForm,
        isAvailable: doctorForm.isAvailable === "true",
      };

      if (editingDoctorId !== null) {
        await apiRequest(`/admin/doctors/${editingDoctorId}`, {
          method: "PUT",
          token,
          body: JSON.stringify(body),
        });
        setNotice("Doctor updated.");
      } else {
        await apiRequest("/admin/doctors", {
          method: "POST",
          token,
          body: JSON.stringify(body),
        });
        setNotice("Doctor added.");
      }

      cancelDoctorEdit();
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDoctor(doctor) {
    if (!window.confirm(`Delete doctor ${doctor.fullName}?`)) return;

    setError("");
    setNotice("");

    try {
      await apiRequest(`/admin/doctors/${doctor.id}`, {
        method: "DELETE",
        token,
      });
      setNotice("Doctor deleted.");
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateAppointmentStatus(appointment, status) {
    setError("");
    setNotice("");

    try {
      await apiRequest(`/admin/appointments/${appointment.id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setNotice(`Appointment ${status}.`);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin dashboard</p>
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

      <nav className="dashboard-tabs" aria-label="Admin sections">
        <button
          type="button"
          aria-pressed={activeSection === "patients"}
          onClick={() => setActiveSection("patients")}
        >
          Patients ({patients.length})
        </button>
        <button
          type="button"
          aria-pressed={activeSection === "doctors"}
          onClick={() => setActiveSection("doctors")}
        >
          Doctors ({doctors.length})
        </button>
        <button
          type="button"
          aria-pressed={activeSection === "appointments"}
          onClick={() => setActiveSection("appointments")}
        >
          Appointments ({appointments.length})
        </button>
      </nav>

      {loading ? (
        <p>Loading dashboard…</p>
      ) : activeSection === "patients" ? (
        <>
          <section className="dashboard-section">
            <h2>{editingPatientId !== null ? "Edit patient" : "Add patient"}</h2>
            <form className="dashboard-form" onSubmit={savePatient}>
              <TextField
                label="Full name"
                name="patient-full-name"
                type="text"
                minLength={2}
                maxLength={120}
                value={patientForm.fullName}
                onChange={(event) =>
                  setPatientForm({
                    ...patientForm,
                    fullName: event.target.value,
                  })
                }
                required
              />
              <TextField
                label="Email"
                name="patient-email"
                type="email"
                value={patientForm.email}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, email: event.target.value })
                }
                required
              />
              <TextField
                label={
                  editingPatientId !== null
                    ? "New password (optional)"
                    : "Password"
                }
                name="patient-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={patientForm.password}
                onChange={(event) =>
                  setPatientForm({
                    ...patientForm,
                    password: event.target.value,
                  })
                }
                required={editingPatientId === null}
              />
              <TextField
                label="Phone"
                name="patient-phone"
                type="tel"
                maxLength={30}
                value={patientForm.phone}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, phone: event.target.value })
                }
              />
              <TextField
                label="Date of birth"
                name="patient-date-of-birth"
                type="date"
                value={patientForm.dateOfBirth}
                onChange={(event) =>
                  setPatientForm({
                    ...patientForm,
                    dateOfBirth: event.target.value,
                  })
                }
              />
              <TextField
                label="Gender"
                name="patient-gender"
                type="text"
                maxLength={30}
                value={patientForm.gender}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, gender: event.target.value })
                }
              />
              <TextField
                label="Address"
                name="patient-address"
                type="text"
                maxLength={255}
                value={patientForm.address}
                onChange={(event) =>
                  setPatientForm({ ...patientForm, address: event.target.value })
                }
              />
              <div className="form-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving
                    ? "Saving…"
                    : editingPatientId !== null
                      ? "Save patient"
                      : "Add patient"}
                </button>
                {editingPatientId !== null && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={cancelPatientEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="dashboard-section">
            <h2>Patients</h2>
            {patients.length === 0 ? (
              <p>No patients found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id}>
                        <td>{patient.fullName}</td>
                        <td>{patient.email}</td>
                        <td>{patient.phone || "—"}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => startEditingPatient(patient)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => deletePatient(patient)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : activeSection === "doctors" ? (
        <>
          <section className="dashboard-section">
            <h2>{editingDoctorId !== null ? "Edit doctor" : "Add doctor"}</h2>
            <form className="dashboard-form" onSubmit={saveDoctor}>
              <TextField
                label="Full name"
                name="doctor-full-name"
                type="text"
                minLength={2}
                maxLength={120}
                value={doctorForm.fullName}
                onChange={(event) =>
                  setDoctorForm({ ...doctorForm, fullName: event.target.value })
                }
                required
              />
              <TextField
                label="Email"
                name="doctor-email"
                type="email"
                value={doctorForm.email}
                onChange={(event) =>
                  setDoctorForm({ ...doctorForm, email: event.target.value })
                }
                required
              />
              <TextField
                label={
                  editingDoctorId !== null
                    ? "New password (optional)"
                    : "Password"
                }
                name="doctor-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={doctorForm.password}
                onChange={(event) =>
                  setDoctorForm({ ...doctorForm, password: event.target.value })
                }
                required={editingDoctorId === null}
              />
              <TextField
                label="Specialty"
                name="doctor-specialty"
                type="text"
                minLength={2}
                maxLength={120}
                value={doctorForm.specialty}
                onChange={(event) =>
                  setDoctorForm({
                    ...doctorForm,
                    specialty: event.target.value,
                  })
                }
                required
              />
              <TextField
                label="Phone"
                name="doctor-phone"
                type="tel"
                maxLength={30}
                value={doctorForm.phone}
                onChange={(event) =>
                  setDoctorForm({ ...doctorForm, phone: event.target.value })
                }
              />

              <div className="form-field">
                <label htmlFor="doctor-bio">Bio</label>
                <textarea
                  id="doctor-bio"
                  rows={3}
                  maxLength={5000}
                  value={doctorForm.bio}
                  onChange={(event) =>
                    setDoctorForm({ ...doctorForm, bio: event.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="doctor-availability">Availability</label>
                <select
                  id="doctor-availability"
                  value={doctorForm.isAvailable}
                  onChange={(event) =>
                    setDoctorForm({
                      ...doctorForm,
                      isAvailable: event.target.value,
                    })
                  }
                  required
                >
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={isSaving}>
                  {isSaving
                    ? "Saving…"
                    : editingDoctorId !== null
                      ? "Save doctor"
                      : "Add doctor"}
                </button>
                {editingDoctorId !== null && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={cancelDoctorEdit}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="dashboard-section">
            <h2>Doctors</h2>
            {doctors.length === 0 ? (
              <p>No doctors found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Specialty</th>
                      <th>Availability</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor) => (
                      <tr key={doctor.id}>
                        <td>{doctor.fullName}</td>
                        <td>{doctor.email}</td>
                        <td>{doctor.specialty}</td>
                        <td>
                          {doctor.isAvailable ? "Available" : "Unavailable"}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => startEditingDoctor(doctor)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => deleteDoctor(doctor)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="dashboard-section">
          <h2>All appointments</h2>
          {appointments.length === 0 ? (
            <p>No appointments found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Date and time</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.patientName}</td>
                      <td>
                        {appointment.doctorName} — {appointment.doctorSpecialty}
                      </td>
                      <td>{formatDateTime(appointment.appointmentAt)}</td>
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
                                updateAppointmentStatus(appointment, "approved")
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() =>
                                updateAppointmentStatus(appointment, "declined")
                              }
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
      )}

      <footer className="dashboard-footer">
        <button
          type="button"
          className="button-secondary"
          onClick={loadDashboard}
          disabled={loading}
        >
          Refresh data
        </button>
      </footer>
    </main>
  );
}