/**
 * Seed marketing users into the users table.
 *
 * These users will be able to approve/reject meeting requests.
 * Edit the list below with your team's names and emails.
 *
 * Usage:
 *   DATABASE_URL=<your-neon-url> node scripts/seed-marketing-users.mjs
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Replace these with your team's actual names and Google Workspace emails
const marketingUsers = [
  { name: "Admin User", email: "admin@example.com" },
  { name: "Marketing Lead", email: "marketing@example.com" },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const user of marketingUsers) {
    const id = crypto.randomUUID();
    try {
      await sql`
        INSERT INTO users (id, email, name, role)
        VALUES (${id}, ${user.email}, ${user.name}, 'marketing')
        ON CONFLICT (email) DO UPDATE SET name = ${user.name}
      `;
      console.log(`  + ${user.name} (${user.email})`);
      inserted++;
    } catch (err) {
      console.error(`  x ${user.name}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone: ${inserted} inserted/updated, ${skipped} failed`);
}

main();
