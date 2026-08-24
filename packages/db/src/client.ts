import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export type HeliconDatabase = ReturnType<typeof createDatabase>["db"];
