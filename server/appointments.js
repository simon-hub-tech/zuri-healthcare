import express from "express";
import { pool } from "./db.js";

const router = express.Router();

function normalizeAppointmentAt(value) {
  if (typeof value !== "string") return null;

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) return null;

  const [, date, hourText, minuteText, secondText] = match;
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText || "0");

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  return `${date} ${hourText}:${minuteText}:${secondText || "00"}`;
}

router.get("/my", async (req, res, next) => {
  try {
    const [appointments] = await pool.execute(
      `SELECT
         a.id,
         a.appointment_at AS appointmentAt,
         a.reason,
         a.status,
         a.created_at AS createdAt,
         d.id AS doctorId,
         doctor_user.full_name AS doctorName,
         d.specialty AS doctorSpecialty
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users doctor_user ON doctor_user.id = d.user_id
       WHERE p.user_id = ?
       ORDER BY a.appointment_at DESC`,
      [req.user.id],
    );

    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const doctorId = Number(req.body?.doctorId);
  const appointmentAt = normalizeAppointmentAt(req.body?.appointmentAt);
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  if (!Number.isSafeInteger(doctorId) || doctorId < 1) {
    return res.status(400).json({
      success: false,
      message: "doctorId must be a positive integer.",
    });
  }

  if (!appointmentAt) {
    return res.status(400).json({
      success: false,
      message: "appointmentAt must be a valid local date and time.",
    });
  }

  if (!reason || reason.length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Reason must be between 1 and 1000 characters.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [patients] = await connection.execute(
      "SELECT id FROM patients WHERE user_id = ?",
      [req.user.id],
    );

    if (patients.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Patient profile not found.",
      });
    }

    const [doctors] = await connection.execute(
      `SELECT id
       FROM doctors
       WHERE id = ? AND is_available = TRUE
       FOR UPDATE`,
      [doctorId],
    );

    if (doctors.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Available doctor not found.",
      });
    }

    const [timeCheck] = await connection.execute(
      "SELECT STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s') > NOW() AS isFuture",
      [appointmentAt],
    );

    if (!timeCheck[0].isFuture) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: "Appointment must be in the future.",
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_at, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [patients[0].id, doctorId, appointmentAt, reason],
    );

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Appointment request created.",
      data: {
        id: result.insertId,
        doctorId,
        appointmentAt,
        reason,
        status: "pending",
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "That doctor already has an active appointment at this time.",
      });
    }

    next(error);
  } finally {
    if (connection) connection.release();
  }
});

export default router;