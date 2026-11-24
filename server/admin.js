import express from "express";
import appointmentsRouter from "./admin-appointments.js";
import doctorsRouter from "./admin-doctors.js";
import patientsRouter from "./admin-patients.js";

const router = express.Router();

router.use("/patients", patientsRouter);
router.use("/doctors", doctorsRouter);
router.use("/appointments", appointmentsRouter);

export default router;