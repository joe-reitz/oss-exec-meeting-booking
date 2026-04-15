/**
 * Seed marketing users into the users table.
 *
 * Usage:
 *   DATABASE_URL=<neon-url> node scripts/seed-marketing-users.mjs
 *
 * Or if .env.local has DATABASE_URL:
 *   npx dotenv -e .env.local -- node scripts/seed-marketing-users.mjs
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const marketingUsers = [
  { name: "Helana Zhang", email: "helana.zhang@vercel.com" },
  { name: "Cheryl Wolf", email: "cheryl.wolf@vercel.com" },
  { name: "Ria Parwal", email: "ria.parwal@vercel.com" },
  { name: "Joe Reitz", email: "joe.reitz@vercel.com" },
  { name: "Aarushi Sawnhey", email: "aarushi.sawnhey@vercel.com" },
  { name: "Aisha Rahman", email: "aisha.raman@vercel.com" },
  { name: "Alexander Roth", email: "alexander.roth@vercel.com" },
  { name: "Ali Karukas", email: "ali.karukas@vercel.com" },
  { name: "Alli Pope", email: "alli.pope@vercel.com" },
  { name: "Caroline Ciaramitaro", email: "caroline.ciaramitaro@vercel.com" },
  { name: "Hannah Cordner", email: "hannah.cordner@vercel.com" },
  { name: "Lani Beadle", email: "lani.beadle@vercel.com" },
  { name: "Madison McIlwain", email: "madison.mcilwain@vercel.com" },
  { name: "Meghan Shaefer", email: "meghan.schaefer@vercel.com" },
  { name: "Sharon Toh", email: "sharon.toh@vercel.com" },
  { name: "Taylor Reeves", email: "taylor.reeves@vercel.com" },
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
