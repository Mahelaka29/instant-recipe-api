// import pg from "pg";
// import env from "dotenv";

// env.config();

// const db = new pg.Client({
//   user: process.env.PG_USER,
//   host: process.env.PG_HOST,
//   database: process.env.PG_DATABASE,
//   password: process.env.PG_PASSWORD,
//   port: process.env.PG_PORT,
// });

// db.connect();
// export default db;

import pg from "pg";
import env from "dotenv";

env.config();

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ...(process.env.DATABASE_URL.includes("localhost")
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
    }
  : {
      user: process.env.PG_USER,
      host: process.env.PG_HOST,
      database: process.env.PG_DATABASE,
      password: process.env.PG_PASSWORD,
      port: process.env.PG_PORT,
    };

const db = new pg.Client(connectionConfig);

db.connect();

export default db;