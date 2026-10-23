import { Pool } from "pg";
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://notes:notes@localhost:5433/notes",
});
export const USER_ID = 1;
