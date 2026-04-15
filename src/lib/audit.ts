import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Writes a row to the audit_log table.
 */
export async function logAudit(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values({
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    changes: params.changes ?? null,
  });
}
