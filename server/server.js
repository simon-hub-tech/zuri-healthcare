import app from "./app.js";
import { pool } from "./db.js";

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing the server.`);

  server.close(async (error) => {
    if (error) {
      console.error("Could not close the server cleanly.");
      process.exitCode = 1;
    }

    try {
      await pool.end();
      console.log("Database connection pool closed.");
    } catch {
      console.error("Could not close the database connection pool cleanly.");
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));