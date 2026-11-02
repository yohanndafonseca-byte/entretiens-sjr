import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __client?: ReturnType<typeof createClient> };

const client =
  globalForDb.__client ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__client = client;

export const db = drizzle(client, { schema });
export { schema };
