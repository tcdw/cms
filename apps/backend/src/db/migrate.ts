import { eq } from "drizzle-orm";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { users } from "./schema";
import { hashPassword } from "../utils/auth";

const DEFAULT_ADMIN = {
  username: "admin",
  email: "admin@example.com",
  password: "admin123",
  role: "admin" as const,
};

async function main() {
  const dbPath = (process.env.DATABASE_URL || "file:./cms.db").replace("file:", "");
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  console.log("Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations completed!");

  // Create default admin user if not exists
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, DEFAULT_ADMIN.username))
    .limit(1);

  if (!existingAdmin) {
    console.log("Creating default admin user...");
    const hashedPassword = await hashPassword(DEFAULT_ADMIN.password);
    await db.insert(users).values({
      username: DEFAULT_ADMIN.username,
      email: DEFAULT_ADMIN.email,
      password: hashedPassword,
      role: DEFAULT_ADMIN.role,
    });
    console.log(`Default admin created: ${DEFAULT_ADMIN.username} / ${DEFAULT_ADMIN.password}`);
  } else {
    console.log("Default admin user already exists.");
  }

  sqlite.close();
  process.exit(0);
}

main().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});
