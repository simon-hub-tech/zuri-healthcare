import cors from "cors";
import express from "express";
import adminRouter from "./admin.js";
import appointmentsRouter from "./appointments.js";
import authRouter, { requireAuth, requireRole } from "./auth.js";
import doctorAppointmentsRouter from "./doctor-appointments.js";
import doctorsRouter from "./doctors.js";
import { pool } from "./db.js";

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "10kb" }));

app.use("/api/auth", authRouter);
app.use("/api/admin", requireAuth, requireRole("admin"), adminRouter);
app.use("/api/doctors", doctorsRouter);
app.use(
  "/api/appointments",
  requireAuth,
  requireRole("patient"),
  appointmentsRouter,
);
app.use(
  "/api/doctor/appointments",
  requireAuth,
  requireRole("doctor"),
  doctorAppointmentsRouter,
);

app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      success: true,
      message: "Zuri Healthcare API is running.",
      database: "connected",
    });
  } catch (error) {
    const serviceError = new Error("Service temporarily unavailable.");
    serviceError.statusCode = 503;
    serviceError.cause = error;
    next(serviceError);
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || error.status || 500;

  if (statusCode >= 500) {
    console.error(error.message);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 503
        ? "Service temporarily unavailable."
        : statusCode >= 500
          ? "Internal server error."
          : error.message,
  });
});

export default app;