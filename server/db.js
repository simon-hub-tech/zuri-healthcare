
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDirectory, ".env") });

const requiredSettings = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingSettings = requiredSettings.filter(
  (setting) => !process.env[setting],
);

if (missingSettings.length > 0) {
  throw new Error(
    `Missing database setting(s) in server/.env: ${missingSettings.join(", ")}`,
  );
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});