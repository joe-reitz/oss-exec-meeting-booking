import { NextResponse } from "next/server";
import { db } from "@/db";
import { people } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listOrgUsers } from "@/lib/calcom/users";

export async function POST() {
  try {
    const calcomUsers = await listOrgUsers();
    const allPeople = await db.select().from(people);

    let updated = 0;
    let skipped = 0;

    for (const person of allPeople) {
      if (person.calcomUsername) {
        skipped++;
        continue;
      }

      const match = calcomUsers.find(
        (u) => u.email.toLowerCase() === person.email.toLowerCase()
      );

      if (match) {
        const username =
          match.profile?.username ?? match.username;
        if (username) {
          await db
            .update(people)
            .set({
              calcomUsername: username,
              updatedAt: new Date(),
            })
            .where(eq(people.id, person.id));
          updated++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      updated,
      skipped,
      totalPeople: allPeople.length,
      totalCalcomUsers: calcomUsers.length,
    });
  } catch (error) {
    console.error("Failed to sync Cal.com users:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Cal.com users",
      },
      { status: 500 }
    );
  }
}
