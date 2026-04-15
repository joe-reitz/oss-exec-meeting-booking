import { readFileSync } from "fs";

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: node scripts/import-people.mjs <path-to-csv>");
  process.exit(1);
}
const API_BASE = process.env.APP_URL || "http://localhost:3000";

// Add any CRM system/service accounts to exclude here
const EXCLUDED_NAMES = [
  "Account Marketplace",
  "Sales Queue",
  "Partnerships Queue",
  "CRM API User",
];

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx] || ""));
    rows.push(row);
  }
  return rows;
}

async function main() {
  // Read and parse CSV
  const csv = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(csv);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Filter out service/system accounts
  const filtered = rows.filter((r) => !EXCLUDED_NAMES.includes(r.Name));
  console.log(
    `Filtered to ${filtered.length} people (excluded ${rows.length - filtered.length} service accounts)`
  );

  // Fetch existing people to skip duplicates
  const res = await fetch(`${API_BASE}/api/people?type=ae`);
  if (!res.ok) throw new Error(`Failed to fetch existing people: ${res.status}`);
  const existing = await res.json();
  const existingEmails = new Set(existing.map((p) => p.email.toLowerCase()));
  console.log(`Found ${existing.length} existing AEs`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of filtered) {
    const email = row.Email?.toLowerCase();
    if (!email) {
      console.warn(`  Skipping row with no email: ${row.Name}`);
      skipped++;
      continue;
    }

    if (existingEmails.has(email)) {
      skipped++;
      continue;
    }

    const body = {
      name: row.Name,
      email: row.Email,
      type: "ae",
      ...(row.Title && { title: row.Title }),
      ...(row.Id && { sfdcOwnerId: row.Id }),
    };

    try {
      const resp = await fetch(`${API_BASE}/api/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        created++;
      } else {
        const err = await resp.text();
        console.error(`  Error creating ${row.Name}: ${resp.status} ${err}`);
        errors++;
      }
    } catch (e) {
      console.error(`  Network error for ${row.Name}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
