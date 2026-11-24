import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(currentDirectory, ".env") });

async function main() {
  const adminPassword = process.env.ZURI_ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "Set ZURI_ADMIN_PASSWORD to a password with at least 12 characters before running this script.",
    );
  }

  const prompt = createInterface({ input: stdin, output: stdout });

  let connection;

  try {
    const fullName = (await prompt.question("Admin full name: ")).trim();
    const email = (await prompt.question("Admin email: ")).trim().toLowerCase();

    if (!fullName || !email.includes("@")) {
      throw new Error("Enter a name and a valid email address.");
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
    });

    const [existingUsers] = await connection.execute(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );

    if (existingUsers.length > 0) {
      throw new Error("A user with that email already exists.");
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await connection.execute(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES (?, ?, ?, 'admin')`,
      [fullName, email, passwordHash],
    );

    console.log(`Admin account created for ${email}.`);
  } finally {
    prompt.close();

    if (connection) {
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error(`Could not create Admin account: ${error.message}`);
  process.exitCode = 1;
});