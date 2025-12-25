import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

async function main() {
  const dbPath = (process.env.DATABASE_URL || "file:./cms.db").replace("file:", "");
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  console.log("Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed!");

  sqlite.close();
  process.exit(0);
}

main().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});
