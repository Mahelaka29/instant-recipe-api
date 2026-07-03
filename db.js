import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

function isLocal(value) {
  return value?.includes("localhost") || value?.includes("127.0.0.1");
}

// Render internal URLs use the private network and must NOT use SSL.
// External URLs (*.render.com) require SSL.
function needsSsl(value) {
  if (!value || isLocal(value)) return false;
  if (value.includes("render-internal.com")) return false;
  if (/@dpg-[a-z0-9-]+-a[/:]/.test(value) && !value.includes(".render.com")) {
    return false;
  }
  return true;
}

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    const useSsl = needsSsl(process.env.DATABASE_URL);
    console.log(
      `DB: using DATABASE_URL (${useSsl ? "SSL enabled" : "SSL disabled, internal/private network"})`
    );
    return {
      connectionString: process.env.DATABASE_URL,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  if (process.env.PG_HOST) {
    const useSsl = needsSsl(process.env.PG_HOST);
    console.log(
      `DB: using PG_* vars (${useSsl ? "SSL enabled" : "SSL disabled, internal/private network"})`
    );
    return {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  throw new Error(
    "Database configuration missing. On Render, link your Postgres database or set DATABASE_URL."
  );
}

const db = new pg.Client(buildConnectionConfig());

export default db;
