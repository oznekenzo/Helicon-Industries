import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/drizzle/migrations",
  strict: true,
  verbose: true,
});
