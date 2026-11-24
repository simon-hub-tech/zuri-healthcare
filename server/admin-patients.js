import bcrypt from "bcryptjs";
import express from "express";
import { pool } from "./db.js";

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validDateOnly(value) {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function readPatientFields(body, passwordRequired) {
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
  const phone =
    typeof source.phone === "string" ? source.phone.trim() : "";
  const dateOfBirth = source.dateOfBirth || null;
  const gender = typeof source.gender === "string" ? source.gender.trim() : "";
  const address =
    typeof source.address === "string" ? source.address.trim() : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Full name must be between 2 and 120 characters." };
  }

  if (!emailPattern.test(email) || email.length > 255) {
    return { error: "Enter a valid email address." };
  }

  if (
    (passwordRequired && password.length < 8) ||
    (password && (password.length < 8 || Buffer.byteLength(password, "utf8") > 72))
  ) {
    return { error: "Password must be 8 to 72 bytes." };
  }

  if (phone.length > 30) {
    return { error: "Phone number must be 30 characters or fewer." };
  }

  if (!validDateOnly(dateOfBirth)) {
    return { error: "Date of birth must be a valid date in YYYY-MM-DD format." };
  }

  if (gender.length > 30) {
    return { error: "Gender must be 30 characters or fewer." };
  }

  if (address.length > 255) {
    return { error: "Address must be 255 characters or fewer." };
  }

  return {
    values: {
      fullName,
      email,
      password,
      phone: phone || null,
      dateOfBirth,
      gender: gender || null,
      address: address || null,
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
      message: "This patient has appointments and cannot be deleted.",
    });
  }

  return next(error);
}

router.get("/", async (req, res, next) => {
  try {
    const [patients] = await pool.execute(
      `SELECT
         p.id,
         u.full_name AS fullName,
         u.email,
         p.phone,
         p.date_of_birth AS dateOfBirth,
         p.gender,
         p.address,
         p.created_at AS createdAt
       FROM patients p
       JOIN users u ON u.id = p.user_id
       ORDER BY u.full_name`,
    );

    res.status(200).json({ success: true, data: patients });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  const result = readPatientFields(req.body, true);

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
       VALUES (?, ?, ?, 'patient')`,
      [values.fullName, values.email, passwordHash],
    );

    const [patientResult] = await connection.execute(
      `INSERT INTO patients
         (user_id, phone, date_of_birth, gender, address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userResult.insertId,
        values.phone,
        values.dateOfBirth,
        values.gender,
        values.address,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Patient created.",
      data: {
        id: patientResult.insertId,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        address: values.address,
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
      message: "Patient ID must be a positive integer.",
    });
  }

  const result = readPatientFields(req.body, false);

  if (result.error) {
    return res.status(400).json({ success: false, message: result.error });
  }

  const { values } = result;
  let connection;
  let transactionStarted = false;

  try {
    const [matches] = await pool.execute(
      "SELECT user_id FROM patients WHERE id = ?",
      [id],
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found.",
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
      `UPDATE patients
       SET phone = ?, date_of_birth = ?, gender = ?, address = ?
       WHERE id = ?`,
      [
        values.phone,
        values.dateOfBirth,
        values.gender,
        values.address,
        id,
      ],
    );

    await connection.commit();
    transactionStarted = false;

    res.status(200).json({
      success: true,
      message: "Patient updated.",
      data: {
        id,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        address: values.address,
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
      message: "Patient ID must be a positive integer.",
    });
  }

  try {
    const [matches] = await pool.execute(
      "SELECT user_id FROM patients WHERE id = ?",
      [id],
    );

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found.",
      });
    }

    await pool.execute("DELETE FROM users WHERE id = ?", [matches[0].user_id]);

    res.status(200).json({
      success: true,
      message: "Patient deleted.",
    });
  } catch (error) {
    handleDatabaseError(error, res, next);
  }
});

export default router;