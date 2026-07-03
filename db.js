import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

function isLocal(hostOrUrl) {
  return hostOrUrl?.includes("localhost") || hostOrUrl?.includes("127.0.0.1");
}

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...(isLocal(process.env.DATABASE_URL)
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
    };
  }

  if (process.env.PG_HOST) {
    return {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT,
      ...(isLocal(process.env.PG_HOST)
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
    };
  }

  throw new Error(
    "Database configuration missing. On Render, set DATABASE_URL to your Postgres Internal Database URL."
  );
}

const db = new pg.Client(buildConnectionConfig());

export default db;
