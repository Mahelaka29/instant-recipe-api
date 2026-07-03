import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

function isLocal(value) {
  return value?.includes("localhost") || value?.includes("127.0.0.1");
}

// External: dpg-xxx-a.region-postgres.render.com
// Internal: dpg-xxx-a (private network, no SSL)
function toRenderInternalUrl(url) {
  if (!url || !process.env.RENDER) return url;

  const internal = url.replace(
    /@(dpg-[a-z0-9-]+-a)\.[a-z0-9-]+-postgres\.render\.com/i,
    "@$1"
  );

  if (internal !== url) {
    console.log("DB: using Internal hostname (converted from External URL on Render)");
    return internal;
  }

  return url;
}

function toRenderInternalHost(host) {
  if (!host || !process.env.RENDER) return host;

  const match = host.match(/^(dpg-[a-z0-9-]+-a)\.[a-z0-9-]+-postgres\.render\.com$/i);
  if (match) {
    console.log("DB: using Internal hostname (converted from External host on Render)");
    return match[1];
  }

  return host;
}

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
    const connectionString = toRenderInternalUrl(process.env.DATABASE_URL);
    const useSsl = needsSsl(connectionString);
    console.log(
      `DB: using DATABASE_URL (${useSsl ? "SSL enabled" : "SSL disabled, internal/private network"})`
    );
    return {
      connectionString,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    };
  }

  if (process.env.PG_HOST) {
    const host = toRenderInternalHost(process.env.PG_HOST);
    const useSsl = needsSsl(host);
    console.log(
      `DB: using PG_* vars (${useSsl ? "SSL enabled" : "SSL disabled, internal/private network"})`
    );
    return {
      user: process.env.PG_USER,
      host,
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
