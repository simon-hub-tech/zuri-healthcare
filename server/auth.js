import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDirectory, ".env") });

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET in server/.env must be at least 32 characters.");
}

const router = express.Router();
const validRoles = new Set(["patient", "doctor", "admin"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
  return jwt.sign(
    { role: user.role },
    jwtSecret,
    {
      subject: String(user.id),
      expiresIn: "1h",
    },
  );
}

function createUserResponse(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
}

router.post("/register", async (req, res, next) => {
  const fullName =
    typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const phone =
    typeof req.body?.phone === "string" ? req.body.phone.trim() : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({
      success: false,
      message: "Full name must be between 2 and 120 characters.",
    });
  }

  if (!emailPattern.test(email) || email.length > 255) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address.",
    });
  }

  if (
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters and no more than 72 bytes.",
    });
  }

  if (phone.length > 30) {
    return res.status(400).json({
      success: false,
      message: "Phone number must be 30 characters or fewer.",
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const passwordHash = await bcrypt.hash(password, 12);

    const [userResult] = await connection.execute(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'patient')`,
      [fullName, email, passwordHash],
    );

    await connection.execute(
      "INSERT INTO patients (user_id, phone) VALUES (?, ?)",
      [userResult.insertId, phone || null],
    );

    await connection.commit();
    transactionStarted = false;

    const user = {
      id: userResult.insertId,
      full_name: fullName,
      email,
      role: "patient",
    };

    return res.status(201).json({
      success: true,
      message: "Patient account created.",
      data: {
        token: createToken(user),
        user: createUserResponse(user),
      },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists.",
      });
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/login", async (req, res, next) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!emailPattern.test(email) || !password) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address and password.",
    });
  }

  try {
    const [users] = await pool.execute(
      `SELECT id, full_name, email, password_hash, role
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: "Email or password is incorrect.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        token: createToken(user),
        user: createUserResponse(user),
      },
    });
  } catch (error) {
    return next(error);
  }
});

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.trim().split(/\s+/);

  if (!token || scheme?.toLowerCase() !== "bearer") {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const userId = Number(payload.sub);

    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !validRoles.has(payload.role)
    ) {
      return res.status(401).json({
        success: false,
        message: "The authentication token is invalid.",
      });
    }

    req.user = {
      id: userId,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "The authentication token is invalid or expired.",
    });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
}

export default router;