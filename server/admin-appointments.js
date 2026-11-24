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
         d.id AS doctorId,
         doctor_user.full_name AS doctorName,
         d.specialty AS doctorSpecialty
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users patient_user ON patient_user.id = p.user_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users doctor_user ON doctor_user.id = d.user_id
       ORDER BY a.appointment_at DESC`,
    );

    res.status(200).json({
      success: true,
      data: appointments,
    });
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
    const [matches] = await pool.execute(
      "SELECT status FROM appointments WHERE id = ?",
      [id],
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (matches[0].status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending appointments can be changed.",
      });
    }

    const [result] = await pool.execute(
      `UPDATE appointments
       SET status = ?
       WHERE id = ? AND status = 'pending'`,
      [status, id],
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