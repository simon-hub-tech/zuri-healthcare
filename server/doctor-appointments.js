import express from "express";
import { pool } from "./db.js";

const router = express.Router();
const allowedStatuses = new Set(["approved", "declined"]);

router.get("/", async (req, res, next) => {
  try {
    const [appointments] = await pool.execute(
      `SELECT
         a.id,
         a.appointment_at AS appointmentAt,
         a.reason,
         a.status,
         a.created_at AS createdAt,
         p.id AS patientId,
         patient_user.full_name AS patientName,
         patient_user.email AS patientEmail,
         p.phone AS patientPhone
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users patient_user ON patient_user.id = p.user_id
       JOIN doctors d ON d.id = a.doctor_id
       WHERE d.user_id = ?
       ORDER BY a.appointment_at ASC`,
      [req.user.id],
    );

    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  const id = Number(req.params.id);
  const status = req.body?.status;

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: "Appointment ID must be a positive integer.",
    });
  }

  if (!allowedStatuses.has(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be approved or declined.",
    });
  }

  try {
    const [doctors] = await pool.execute(
      "SELECT id FROM doctors WHERE user_id = ?",
      [req.user.id],
    );

    if (doctors.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found.",
      });
    }

    const doctorId = doctors[0].id;
    const [appointments] = await pool.execute(
      "SELECT status FROM appointments WHERE id = ? AND doctor_id = ?",
      [id, doctorId],
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this doctor.",
      });
    }

    if (appointments[0].status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending appointments can be changed.",
      });
    }

    const [result] = await pool.execute(
      `UPDATE appointments
       SET status = ?
       WHERE id = ? AND doctor_id = ? AND status = 'pending'`,
      [status, id, doctorId],
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message: "The appointment status changed before this update.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Appointment ${status}.`,
      data: { id, status },
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "That doctor already has an active appointment at this time.",
      });
    }

    next(error);
  }
});

export default router;