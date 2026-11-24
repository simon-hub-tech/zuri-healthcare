import bcrypt from "bcryptjs";
import express from "express";
import { pool } from "./db.js";

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readDoctorFields(body, passwordRequired) {
  const source =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const fullName =
    typeof source.fullName === "string" ? source.fullName.trim() : "";
  const email =
    typeof source.email === "string"
      ? source.email.trim().toLowerCase()
      : "";
  const password =
    typeof source.password === "string" ? source.password : "";
  const specialty =
    typeof source.specialty === "string" ? source.specialty.trim() : "";
  const phone = typeof source.phone === "string" ? source.phone.trim() : "";
  const bio = typeof source.bio === "string" ? source.bio.trim() : "";
  const isAvailable = source.isAvailable;

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Full name must be between 2 and 120 characters." };
  }

  if (!emailPattern.test(email) || email.length > 255) {
    return { error: "Enter a valid email address." };
  }

  if (
    (passwordRequired && password.length < 8) ||
    (password &&
      (password.length < 8 || Buffer.byteLength(password, "utf8") > 72))
  ) {
    return { error: "Password must be 8 to 72 bytes." };
  }

  if (specialty.length < 2 || specialty.length > 120) {
    return { error: "Specialty must be between 2 and 120 characters." };
  }

  if (phone.length > 30) {
    return { error: "Phone number must be 30 characters or fewer." };
  }

  if (bio.length > 5000) {
    return { error: "Bio must be 5000 characters or fewer." };
  }

  if (typeof isAvailable !== "boolean") {
    return { error: "isAvailable must be true or false." };
  }

  return {
    values: {
      fullName,
      email,
      password,
      specialty,
      phone: phone || null,
      bio: bio || null,
      isAvailable,
    },
  };
}

function handleDatabaseError(error, res, next) {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "An account with that email already exists.",
    });
  }

  if (error.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({
      success: false,
      message: "This doctor has appointments and cannot be deleted.",
    });
  }

  return next(error);
}

router.get("/", async (req, res, next) => {
  try {
    const [doctors] = await pool.execute(
      `SELECT
         d.id,
         u.full_name AS fullName,
         u.email,
         d.specialty,
         d.phone,
         d.bio,
         d.is_available AS isAvailable,
         d.created_at AS createdAt
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       ORDER BY u.full_name`,
    );

    res.status(200).json({
      success: true,
      data: doctors.map((doctor) => ({
        ...doctor,
        isAvailable: Boolean(doctor.isAvailable),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const result = readDoctorFields(req.body, true);

  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }

  const { values } = result;
  let connection;
  let transactionStarted = false;

  try {
    const passwordHash = await bcrypt.hash(values.password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [userResult] = await connection.execute(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'doctor')`,
      [values.fullName, values.email, passwordHash],
    );

    const [doctorResult] = await connection.execute(
      `INSERT INTO doctors
         (user_id, specialty, phone, bio, is_available)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userResult.insertId,
        values.specialty,
        values.phone,
        values.bio,
        values.isAvailable,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Doctor created.",
      data: {
        id: doctorResult.insertId,
        fullName: values.fullName,
        email: values.email,
        specialty: values.specialty,
        phone: values.phone,
        bio: values.bio,
        isAvailable: values.isAvailable,
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }
    handleDatabaseError(error, res, next);
  } finally {
    if (connection) connection.release();
  }
});

router.put("/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: "Doctor ID must be a positive integer.",
    });
  }

  const result = readDoctorFields(req.body, false);

  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }

  const { values } = result;
  let connection;
  let transactionStarted = false;

  try {
    const [matches] = await pool.execute(
      "SELECT user_id FROM doctors WHERE id = ?",
      [id],
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    const userId = matches[0].user_id;
    const passwordHash = values.password
      ? await bcrypt.hash(values.password, 12)
      : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    if (passwordHash) {
      await connection.execute(
        `UPDATE users
         SET full_name = ?, email = ?, password_hash = ?
         WHERE id = ?`,
        [values.fullName, values.email, passwordHash, userId],
      );
    } else {
      await connection.execute(
        `UPDATE users
         SET full_name = ?, email = ?
         WHERE id = ?`,
        [values.fullName, values.email, userId],
      );
    }

    await connection.execute(
      `UPDATE doctors
       SET specialty = ?, phone = ?, bio = ?, is_available = ?
       WHERE id = ?`,
      [
        values.specialty,
        values.phone,
        values.bio,
        values.isAvailable,
        id,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    res.status(200).json({
      success: true,
      message: "Doctor updated.",
      data: {
        id,
        fullName: values.fullName,
        email: values.email,
        specialty: values.specialty,
        phone: values.phone,
        bio: values.bio,
        isAvailable: values.isAvailable,
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }
    handleDatabaseError(error, res, next);
  } finally {
    if (connection) connection.release();
  }
});

router.delete("/:id", async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      success: false,
      message: "Doctor ID must be a positive integer.",
    });
  }

  try {
    const [matches] = await pool.execute(
      "SELECT user_id FROM doctors WHERE id = ?",
      [id],
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    await pool.execute("DELETE FROM users WHERE id = ?", [matches[0].user_id]);

    res.status(200).json({
      success: true,
      message: "Doctor deleted.",
    });
  } catch (error) {
    handleDatabaseError(error, res, next);
  }
});

export default router;