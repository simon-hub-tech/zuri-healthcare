import express from "express";
import { pool } from "./db.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const [doctors] = await pool.execute(
      `SELECT
         d.id,
         u.full_name AS fullName,
         d.specialty,
         d.phone,
         d.bio
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.is_available = TRUE
       ORDER BY u.full_name`,
    );

    res.status(200).json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    next(error);
  }
});

export default router;