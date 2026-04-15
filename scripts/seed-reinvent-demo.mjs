/**
 * Seed script: AWS re:Invent 2025 Demo Event
 *
 * Creates a realistic demo event with rooms, meetings, people, and pipeline
 * data so stakeholders can visualize the dashboard.
 *
 * Usage:
 *   node scripts/seed-reinvent-demo.mjs
 *
 * Requires:
 *   - App running at APP_URL (default: https://exec-meeting-booking.vercel.sh)
 *   - Or set APP_URL env var to point to local/preview deployment
 *
 * To clean up: delete the "AWS re:Invent 2025" event from the Events page.
 */

const APP_URL =
  process.env.APP_URL || "http://localhost:3099";

async function api(path, options = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} on ${path}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Demo Data ───────────────────────────────────────────────────────

const EXECS = [
  { name: "Guillermo Rauch", email: "guillermo@vercel.com", type: "exec", title: "CEO" },
  { name: "Jeanne Grosser", email: "jeanne@vercel.com", type: "exec", title: "CRO" },
  { name: "Shu Ding", email: "shu@vercel.com", type: "exec", title: "VP of Engineering" },
];

const AES = [
  { name: "Joe Reitz", email: "joe.reitz@vercel.com", type: "ae", title: "Marketing Ops" },
  { name: "Sarah Chen", email: "sarah.chen@vercel.com", type: "ae", title: "Enterprise AE" },
  { name: "Marcus Williams", email: "marcus.williams@vercel.com", type: "ae", title: "Enterprise AE" },
  { name: "Emily Park", email: "emily.park@vercel.com", type: "ae", title: "Commercial AE" },
  { name: "David Rodriguez", email: "david.rodriguez@vercel.com", type: "ae", title: "Commercial AE" },
  { name: "Lisa Nguyen", email: "lisa.nguyen@vercel.com", type: "ae", title: "Mid-Market AE" },
];

const ROOMS = [
  { name: "Venetian Suite A", description: "Executive boardroom, 20th floor", capacity: 8 },
  { name: "Venetian Suite B", description: "Executive boardroom, 20th floor", capacity: 8 },
  { name: "Wynn Meeting Room 1", description: "Ground floor meeting room", capacity: 6 },
  { name: "Wynn Meeting Room 2", description: "Ground floor meeting room", capacity: 6 },
  { name: "Encore Lounge", description: "Casual meeting space", capacity: 4 },
];

const SEGMENTS = ["Commercial", "SMB", "Startups", "Majors"];

const COMPANIES = [
  { name: "Snowflake", contact: "Mike Thompson", email: "mike.t@snowflake.com", title: "VP Engineering", segment: "Majors" },
  { name: "Datadog", contact: "Rachel Kim", email: "rachel.k@datadog.com", title: "Director of Platform", segment: "Majors" },
  { name: "HashiCorp", contact: "James Liu", email: "james.liu@hashicorp.com", title: "CTO", segment: "Majors" },
  { name: "Confluent", contact: "Anna Petrova", email: "anna.p@confluent.io", title: "SVP Product", segment: "Commercial" },
  { name: "Supabase", contact: "Paul Copplestone", email: "paul@supabase.io", title: "CEO", segment: "Startups" },
  { name: "Neon", contact: "Nikita Shamgunov", email: "nikita@neon.tech", title: "CEO", segment: "Startups" },
  { name: "PlanetScale", contact: "Sam Lambert", email: "sam@planetscale.com", title: "CEO", segment: "SMB" },
  { name: "Retool", contact: "David Hsu", email: "david@retool.com", title: "CEO", segment: "SMB" },
  { name: "Notion", contact: "Ivan Zhao", email: "ivan@notion.so", title: "CEO", segment: "Majors" },
  { name: "Figma", contact: "Dylan Field", email: "dylan@figma.com", title: "CEO", segment: "Majors" },
  { name: "Linear", contact: "Karri Saarinen", email: "karri@linear.app", title: "CEO", segment: "Startups" },
  { name: "Vercel Customer Corp", contact: "Jennifer Walsh", email: "jennifer@customercorp.com", title: "Director Eng", segment: "Commercial" },
  { name: "Acme Inc", contact: "Bob Smith", email: "bob@acme.com", title: "VP Platform", segment: "Commercial" },
  { name: "TechFlow", contact: "Diana Chen", email: "diana@techflow.io", title: "CTO", segment: "SMB" },
  { name: "CloudFirst", contact: "Ryan O'Brien", email: "ryan@cloudfirst.com", title: "VP Infrastructure", segment: "Commercial" },
  { name: "ScaleAI", contact: "Alex Wang", email: "alex@scale.ai", title: "CEO", segment: "Startups" },
  { name: "Stripe", contact: "Will Gaybrick", email: "will@stripe.com", title: "CFO", segment: "Majors" },
  { name: "Shopify", contact: "Kaz Nejatian", email: "kaz@shopify.com", title: "VP Product", segment: "Majors" },
];

// Pipeline data — opportunities created after 11/30 with amounts
const PIPELINE = [
  { company: "Snowflake", amount: 2_500_000, stage: "Negotiation", probability: 75 },
  { company: "Datadog", amount: 1_800_000, stage: "Proposal", probability: 50 },
  { company: "Notion", amount: 950_000, stage: "Closed Won", probability: 100 },
  { company: "Figma", amount: 1_200_000, stage: "Negotiation", probability: 65 },
  { company: "Stripe", amount: 3_000_000, stage: "Discovery", probability: 25 },
  { company: "Shopify", amount: 2_200_000, stage: "Proposal", probability: 55 },
  { company: "HashiCorp", amount: 750_000, stage: "Closed Won", probability: 100 },
  { company: "Confluent", amount: 480_000, stage: "Negotiation", probability: 70 },
  { company: "Supabase", amount: 180_000, stage: "Closed Won", probability: 100 },
  { company: "PlanetScale", amount: 220_000, stage: "Proposal", probability: 40 },
  { company: "Retool", amount: 340_000, stage: "Discovery", probability: 20 },
  { company: "Linear", amount: 150_000, stage: "Negotiation", probability: 60 },
  { company: "CloudFirst", amount: 560_000, stage: "Proposal", probability: 45 },
  { company: "ScaleAI", amount: 420_000, stage: "Discovery", probability: 30 },
];

const RSVP_STATUSES = ["accepted", "accepted", "accepted", "accepted", "tentative", "needsAction"];

// ── Helpers ─────────────────────────────────────────────────────────

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function eventDate(dayOffset, hour, minute = 0) {
  // re:Invent 2025 was Dec 1-5, 2025
  const d = new Date(2025, 11, 1 + dayOffset, hour, minute);
  return d.toISOString();
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding AWS re:Invent 2025 demo data...\n");

  // 1. Create execs and AEs (skip if email already exists)
  console.log("👥 Creating people...");
  const existingPeople = await api("/api/people");
  const existingEmails = new Set(existingPeople.map((p) => p.email.toLowerCase()));

  const allPeople = [...EXECS, ...AES];
  const createdPeople = [];

  for (const person of allPeople) {
    if (existingEmails.has(person.email.toLowerCase())) {
      const existing = existingPeople.find(
        (p) => p.email.toLowerCase() === person.email.toLowerCase()
      );
      createdPeople.push(existing);
      console.log(`  ✓ ${person.name} (already exists)`);
    } else {
      const created = await api("/api/people", {
        method: "POST",
        body: JSON.stringify({
          ...person,
          googleCalendarId: person.email,
        }),
      });
      createdPeople.push(created);
      console.log(`  + ${person.name}`);
    }
  }

  const execIds = createdPeople.filter((p) => p.type === "exec").map((p) => p.id);
  const aeIds = createdPeople.filter((p) => p.type === "ae").map((p) => p.id);

  // 2. Create event
  console.log("\n📅 Creating event...");
  const event = await api("/api/events", {
    method: "POST",
    body: JSON.stringify({
      name: "AWS re:Invent 2025",
      description:
        "Annual AWS conference — exec meeting program. Campaign ID: 701PZ00000cvCwEYAU",
      location: "Las Vegas, NV",
      startDate: "2025-12-01",
      endDate: "2025-12-05",
      timezone: "America/Los_Angeles",
      color: "#f97316",
      isActive: true,
      participantIds: execIds,
      goals: [
        {
          name: "Executive Meetings",
          targetValue: 18,
          segments: [
            { segmentName: "Majors", targetValue: 6 },
            { segmentName: "Commercial", targetValue: 5 },
            { segmentName: "Startups", targetValue: 4 },
            { segmentName: "SMB", targetValue: 3 },
          ],
        },
      ],
    }),
  });
  console.log(`  ✓ Created: ${event.name} (${event.id})`);

  // 3. Create rooms
  console.log("\n🚪 Creating rooms...");
  const createdRooms = [];
  for (const room of ROOMS) {
    const created = await api(`/api/events/${event.id}/rooms`, {
      method: "POST",
      body: JSON.stringify(room),
    });
    createdRooms.push(created);
    console.log(`  + ${room.name}`);
  }

  // 4. Build meetings and opportunities, then bulk-insert via /api/seed
  console.log("\n📋 Building meetings...");
  const seedMeetings = [];

  for (const company of COMPANIES) {
    const dayOffset = Math.floor(Math.random() * 5); // Day 0-4
    const hour = 8 + Math.floor(Math.random() * 9); // 8am-4pm
    const minute = Math.random() > 0.5 ? 30 : 0;
    const duration = Math.random() > 0.3 ? 30 : 60;
    const room = randomFrom(createdRooms);
    const exec = randomFrom(execIds);
    const ae = randomFrom(aeIds);
    const rsvp = randomFrom(RSVP_STATUSES);
    const status = rsvp === "accepted" ? "confirmed" : "pending";

    const startTime = eventDate(dayOffset, hour, minute);
    const endTime = eventDate(dayOffset, hour, minute + duration);

    seedMeetings.push({
      title: `${company.name} Exec Meeting`,
      eventId: event.id,
      roomId: room.id,
      startTime,
      endTime,
      durationMinutes: duration,
      status,
      externalAttendeeName: company.contact,
      externalAttendeeEmail: company.email,
      externalAttendeeCompany: company.name,
      externalAttendeeTitle: company.title,
      externalRsvpStatus: rsvp,
      segment: company.segment,
      participantIds: [exec, ae],
    });

    console.log(
      `  + Day ${dayOffset + 1} ${hour}:${minute.toString().padStart(2, "0")} — ${company.name} (${room.name.split(" ").pop()}) [${rsvp}]`
    );
  }

  console.log("\n💰 Building pipeline opportunities...");
  const seedOpps = [];

  for (const opp of PIPELINE) {
    const ae = randomFrom(createdPeople.filter((p) => p.type === "ae"));
    const oppId = `006DEMO${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

    seedOpps.push({
      id: oppId,
      name: `${opp.company} — Vercel Enterprise`,
      accountName: opp.company,
      ownerName: ae.name,
      ownerId: ae.sfdcOwnerId || ae.id,
      stageName: opp.stage,
      amount: opp.amount,
      closeDate: "2026-03-31",
      probability: opp.probability,
      type: "New Business",
    });

    console.log(
      `  + ${opp.company}: $${(opp.amount / 1000).toFixed(0)}K (${opp.stage})`
    );
  }

  console.log("\n⬆️  Inserting via /api/seed...");
  const seedResult = await api("/api/seed", {
    method: "POST",
    body: JSON.stringify({
      meetings: seedMeetings,
      opportunities: seedOpps,
    }),
  });
  console.log(
    `  ✓ Inserted ${seedResult.meetings} meetings, ${seedResult.opportunities} opportunities`
  );

  // Summary
  console.log("\n✅ Done!");
  console.log(`   Event: ${event.name}`);
  console.log(`   Rooms: ${createdRooms.length}`);
  console.log(`   People: ${createdPeople.length}`);
  console.log(`   Meetings: ${meetingCount}`);
  console.log(`   Pipeline: ${PIPELINE.length} opportunities`);
  console.log(
    `\n   Total pipeline: $${(PIPELINE.reduce((s, o) => s + o.amount, 0) / 1_000_000).toFixed(1)}M`
  );
  console.log(`\n🔗 View at: ${APP_URL}/events/${event.id}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
