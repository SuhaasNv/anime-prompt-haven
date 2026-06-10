import type { Pool } from "pg";

export type AuditAction =
  | "list_all_transactions"
  | "list_reports"
  | "moderate_listing"
  | "user_created"
  | "user_deleted"
  | "credits_adjusted";

export interface AuditLog {
  id: string;
  admin_id: string;
  action: AuditAction;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

/**
 * Log an admin action to the audit trail.
 * Used to track all administrative operations for compliance and security.
 */
export async function logAdminAction(
  db: Pool,
  adminId: string,
  action: AuditAction,
  targetId?: string,
  details?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit_logs (admin_id, action, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, action, targetId ?? null, details ?? null, ipAddress ?? null]
    );
  } catch (err) {
    // Never fail an admin operation due to audit logging
    console.error("Failed to log admin action:", err);
  }
}
