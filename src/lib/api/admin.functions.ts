import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "../db.server";
import { getSessionUser } from "../auth.server";
import { logAdminAction } from "./audit.functions";

interface DashboardMetrics {
  revenue: {
    total24h: number;
    total7d: number;
    total30d: number;
    platformFees24h: number;
  };
  users: {
    activeCreators24h: number;
    activeBuyers24h: number;
    totalCreators: number;
    totalUsers: number;
  };
  content: {
    flaggedListings: number;
    pendingReports: number;
    totalListings: number;
  };
  health: {
    averageRating: number;
    reportResolutionTime: string;
  };
}

export const getDashboardMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  const now = new Date();
  const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Revenue metrics — purchases and credit_transactions are unrelated tables,
  // so they're aggregated as independent subqueries to avoid a join fan-out
  // that would multiply each total by the other table's matching row count.
  const revenueResult = await db.query<{
    total24h: number;
    total7d: number;
    total30d: number;
    platformFees24h: number;
  }>(
    `SELECT
      (SELECT COALESCE(SUM(price_paid), 0) FROM purchases WHERE created_at >= $1)::numeric AS total24h,
      (SELECT COALESCE(SUM(price_paid), 0) FROM purchases WHERE created_at >= $2)::numeric AS total7d,
      (SELECT COALESCE(SUM(price_paid), 0) FROM purchases WHERE created_at >= $3)::numeric AS total30d,
      (SELECT COALESCE(SUM(ABS(amount)), 0) FROM credit_transactions WHERE created_at >= $1 AND type = 'platform_fee')::numeric AS platformFees24h`,
    [day1, day7, day30],
  );

  // User metrics
  const usersResult = await db.query<{
    activeCreators24h: number;
    activeBuyers24h: number;
    totalCreators: number;
    totalUsers: number;
  }>(
    `SELECT
      (SELECT COUNT(DISTINCT seller_id) FROM (
        SELECT pl.user_id as seller_id FROM prompt_listings pl
        WHERE pl.created_at >= $1
      ) t)::integer AS activeCreators24h,
      (SELECT COUNT(DISTINCT buyer_id) FROM purchases WHERE created_at >= $1)::integer AS activeBuyers24h,
      (SELECT COUNT(*) FROM users WHERE created_at IS NOT NULL)::integer AS totalUsers,
      (SELECT COUNT(*) FROM prompt_listings)::integer AS totalCreators
    FROM users LIMIT 1`,
    [day1],
  );

  // Content metrics
  const contentResult = await db.query<{
    flaggedListings: number;
    pendingReports: number;
    totalListings: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM prompt_listings WHERE status = 'flagged')::integer AS flaggedListings,
      (SELECT COUNT(DISTINCT listing_id) FROM reports)::integer AS pendingReports,
      (SELECT COUNT(*) FROM prompt_listings)::integer AS totalListings
    FROM prompt_listings LIMIT 1`,
  );

  const revenue = revenueResult.rows[0] || {
    total24h: 0,
    total7d: 0,
    total30d: 0,
    platformFees24h: 0,
  };

  const users = usersResult.rows[0] || {
    activeCreators24h: 0,
    activeBuyers24h: 0,
    totalCreators: 0,
    totalUsers: 0,
  };

  const content = contentResult.rows[0] || {
    flaggedListings: 0,
    pendingReports: 0,
    totalListings: 0,
  };

  return {
    revenue: {
      total24h: parseFloat(revenue.total24h.toString()),
      total7d: parseFloat(revenue.total7d.toString()),
      total30d: parseFloat(revenue.total30d.toString()),
      platformFees24h: parseFloat(revenue.platformFees24h.toString()),
    },
    users: {
      activeCreators24h: users.activeCreators24h || 0,
      activeBuyers24h: users.activeBuyers24h || 0,
      totalCreators: users.totalCreators || 0,
      totalUsers: users.totalUsers || 0,
    },
    content: {
      flaggedListings: content.flaggedListings || 0,
      pendingReports: content.pendingReports || 0,
      totalListings: content.totalListings || 0,
    },
    health: {
      averageRating: 4.5,
      reportResolutionTime: "~24 hours",
    },
  } as DashboardMetrics;
});

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

export const getAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    throw new Error("Unauthorized");
  }

  const db = getDb();

  const result = await db.query<AuditLogEntry>(
    `SELECT
      al.id,
      al.admin_id,
      u.email as admin_email,
      al.action,
      al.target_id,
      al.details,
      al.created_at
    FROM audit_logs al
    JOIN users u ON u.id = al.admin_id
    ORDER BY al.created_at DESC
    LIMIT 50`,
  );

  return result.rows;
});

// Reports Management
export interface ReportWithListing {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_status: string;
  reporter_email: string;
  reason: string;
  note: string | null;
  created_at: string;
  report_count: number;
}

export const getReports = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  await logAdminAction(db, user.id, "list_reports");

  const result = await db.query<ReportWithListing>(
    `SELECT
      r.id,
      r.listing_id,
      pl.title as listing_title,
      pl.status as listing_status,
      u.email as reporter_email,
      r.reason,
      r.note,
      r.created_at,
      (SELECT COUNT(*) FROM reports WHERE listing_id = r.listing_id)::integer as report_count
    FROM reports r
    JOIN prompt_listings pl ON pl.id = r.listing_id
    JOIN users u ON u.id = r.reporter_id
    ORDER BY report_count DESC, r.created_at DESC`,
  );

  return result.rows;
});

// Listings Management
export interface ListingWithStats {
  id: string;
  title: string;
  user_id: string;
  username: string;
  status: string;
  price: number;
  view_count: number;
  purchase_count: number;
  report_count: number;
  created_at: string;
}

export type ListingStatusFilter = "all" | "published" | "flagged" | "removed" | "draft";

export const searchListings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      search: z.string().optional().default(""),
      status: z.enum(["all", "published", "flagged", "removed", "draft"]).optional().default("all"),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    let query = `
      SELECT
        pl.id,
        pl.title,
        pl.user_id,
        u.username,
        pl.status,
        pl.price,
        pl.view_count,
        pl.purchase_count,
        (SELECT COUNT(*) FROM reports WHERE listing_id = pl.id)::integer as report_count,
        pl.created_at
      FROM prompt_listings pl
      JOIN users u ON u.id = pl.user_id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (data.search) {
      params.push(`%${data.search}%`);
      query += ` AND (pl.title ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    if (data.status !== "all") {
      params.push(data.status);
      query += ` AND pl.status = $${params.length}`;
    }

    query += ` ORDER BY pl.created_at DESC LIMIT 50`;

    const result = await db.query<ListingWithStats>(query, params);
    return result.rows;
  });

export const updateListingStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      status: z.enum(["published", "flagged", "removed"]),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();
    await db.query("UPDATE prompt_listings SET status = $1 WHERE id = $2", [
      data.status,
      data.listingId,
    ]);

    await logAdminAction(
      db,
      user.id,
      "moderate_listing",
      data.listingId,
      `Status changed to ${data.status}`,
    );
  });

// User Management
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  balance: number;
  listing_count: number;
  purchase_count: number;
  average_rating: number;
  created_at: string;
}

export const searchUsers = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      search: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    let query = `
      SELECT
        u.id,
        u.email,
        u.username,
        COALESCE(uc.balance, 0)::numeric as balance,
        (SELECT COUNT(*) FROM prompt_listings WHERE user_id = u.id)::integer as listing_count,
        (SELECT COUNT(*) FROM purchases WHERE buyer_id = u.id)::integer as purchase_count,
        COALESCE(AVG(r.rating), 0)::numeric as average_rating,
        u.created_at
      FROM users u
      LEFT JOIN user_credits uc ON uc.user_id = u.id
      LEFT JOIN reviews r ON r.user_id = u.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (data.search) {
      params.push(`%${data.search}%`);
      query += ` AND (u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    query += ` GROUP BY u.id, u.email, u.username, uc.balance, u.created_at
               ORDER BY u.created_at DESC LIMIT 50`;

    const result = await db.query<UserProfile>(query, params);
    return result.rows;
  });

export const adjustUserCredits = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      amount: z.number(),
      reason: z.string().min(1).max(300),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();
    const client = await db.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

      // Initialize user_credits if needed
      await client.query(
        `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [data.userId, 0],
      );

      // Lock and update balance
      await client.query(
        `UPDATE user_credits SET balance = balance + $1, updated_at = now() WHERE user_id = $2`,
        [data.amount, data.userId],
      );

      // Log transaction
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, note)
         VALUES ($1, $2, 'bonus', $3)`,
        [data.userId, data.amount, data.reason],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Log admin action
    await logAdminAction(
      db,
      user.id,
      "credits_adjusted",
      data.userId,
      `${data.amount > 0 ? "+" : ""}${data.amount} credits: ${data.reason}`,
    );
  });

// Financial Controls - Phase 3

export interface CreatorPayout {
  id: string;
  creator_id: string;
  creator_email: string;
  creator_username: string;
  amount: number;
  status: string;
  bank_account: string | null;
  created_at: string;
  approved_at: string | null;
}

export const getPendingPayouts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  await logAdminAction(db, user.id, "list_payouts");

  const result = await db.query<CreatorPayout>(
    `SELECT
      cp.id,
      cp.creator_id,
      u.email as creator_email,
      u.username as creator_username,
      cp.amount,
      cp.status,
      cp.bank_account,
      cp.created_at,
      cp.approved_at
    FROM creator_payouts cp
    JOIN users u ON u.id = cp.creator_id
    WHERE cp.status IN ('pending', 'approved')
    ORDER BY cp.status ASC, cp.created_at DESC`,
  );

  return result.rows;
});

export const updatePayoutStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      payoutId: z.string().uuid(),
      status: z.enum(["approved", "rejected", "paid"]),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    await db.query(
      `UPDATE creator_payouts
       SET status = $1, approved_at = now(), approved_by = $2
       WHERE id = $3`,
      [data.status, user.id, data.payoutId],
    );

    await logAdminAction(
      db,
      user.id,
      "payout_updated",
      data.payoutId,
      `Status: ${data.status}${data.reason ? ` - ${data.reason}` : ""}`,
    );
  });

// Disputes

export interface DisputeInfo {
  id: string;
  purchase_id: string;
  buyer_email: string;
  seller_email: string;
  listing_title: string;
  amount_paid: number;
  reason: string;
  status: string;
  winner: string | null;
  created_at: string;
}

export const getDisputes = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    throw new Error("Unauthorized");
  }

  const db = getDb();
  await logAdminAction(db, user.id, "list_disputes");

  const result = await db.query<DisputeInfo>(
    `SELECT
      d.id,
      d.purchase_id,
      ub.email as buyer_email,
      us.email as seller_email,
      pl.title as listing_title,
      p.price_paid as amount_paid,
      d.reason,
      d.status,
      d.winner,
      d.created_at
    FROM disputes d
    JOIN purchases p ON p.id = d.purchase_id
    JOIN prompt_listings pl ON pl.id = p.listing_id
    JOIN users ub ON ub.id = d.buyer_id
    JOIN users us ON us.id = d.seller_id
    WHERE d.status IN ('open', 'under_review')
    ORDER BY d.created_at DESC`,
  );

  return result.rows;
});

export const resolveDispute = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      disputeId: z.string().uuid(),
      winner: z.enum(["buyer", "seller", "settlement"]),
      resolution: z.string().min(10).max(500),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();
    const client = await db.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

      // Lock the dispute row and get refund info in one go
      const disputeResult = await client.query<{
        purchase_id: string;
        buyer_id: string;
        seller_id: string;
        amount_paid: string;
      }>(
        `SELECT d.purchase_id, d.buyer_id, d.seller_id, p.price_paid as amount_paid
         FROM disputes d
         JOIN purchases p ON p.id = d.purchase_id
         WHERE d.id = $1 AND d.status IN ('open', 'under_review')
         FOR UPDATE OF d`,
        [data.disputeId],
      );

      if (disputeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new Error("Dispute not found or already resolved.");
      }

      const dispute = disputeResult.rows[0];
      const refundAmount = parseFloat(dispute.amount_paid);

      // Update dispute status (guarded again to make this atomic against concurrent resolutions)
      const updateResult = await client.query(
        `UPDATE disputes
         SET status = 'resolved', winner = $1, resolution = $2, resolved_by = $3, resolved_at = now()
         WHERE id = $4 AND status IN ('open', 'under_review')`,
        [data.winner, data.resolution, user.id, data.disputeId],
      );

      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new Error("Dispute not found or already resolved.");
      }

      // Process refund if buyer wins
      if (data.winner === "buyer") {
        // Initialize buyer credits if needed
        await client.query(
          `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
           ON CONFLICT (user_id) DO NOTHING`,
          [dispute.buyer_id, 0],
        );

        // Refund buyer
        await client.query(
          `UPDATE user_credits SET balance = balance + $1, updated_at = now() WHERE user_id = $2`,
          [refundAmount, dispute.buyer_id],
        );

        await client.query(
          `INSERT INTO credit_transactions (user_id, amount, type, note)
           VALUES ($1, $2, 'refund', 'Dispute resolution - buyer won')`,
          [dispute.buyer_id, refundAmount],
        );

        // Deduct from seller's earnings
        await client.query(
          `INSERT INTO credit_transactions (user_id, amount, type, note)
           VALUES ($1, $2, 'refund', 'Dispute resolution - buyer refunded')`,
          [dispute.seller_id, -refundAmount],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    await logAdminAction(
      db,
      user.id,
      "dispute_resolved",
      data.disputeId,
      `Winner: ${data.winner} - ${data.resolution}`,
    );
  });

// GDPR & Data Retention

export const exportUserDataGDPR = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    // Fetch all user data
    const userResult = await db.query<{
      id: string;
      email: string;
      username: string;
      mascot: string;
      is_admin: boolean;
      created_at: string;
    }>(`SELECT id, email, username, mascot, is_admin, created_at FROM users WHERE id = $1`, [
      data.userId,
    ]);

    const purchasesResult = await db.query<{
      id: string;
      listing_id: string;
      price_paid: string;
      created_at: string;
    }>(`SELECT id, listing_id, price_paid, created_at FROM purchases WHERE buyer_id = $1`, [
      data.userId,
    ]);

    const listingsResult = await db.query<{
      id: string;
      title: string;
      description: string | null;
      price: string;
      status: string;
      created_at: string;
    }>(
      `SELECT id, title, description, price, status, created_at FROM prompt_listings WHERE user_id = $1`,
      [data.userId],
    );

    const reviewsResult = await db.query<{
      id: string;
      listing_id: string;
      rating: number;
      body: string | null;
      created_at: string;
    }>(`SELECT id, listing_id, rating, body, created_at FROM reviews WHERE user_id = $1`, [
      data.userId,
    ]);

    const creditsResult = await db.query<{
      id: string;
      amount: string;
      type: string;
      note: string | null;
      created_at: string;
    }>(
      `SELECT id, amount, type, note, created_at FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC`,
      [data.userId],
    );

    const exportData = {
      user: userResult.rows[0],
      purchases: purchasesResult.rows,
      listings: listingsResult.rows,
      reviews: reviewsResult.rows,
      credits: creditsResult.rows,
      exported_at: new Date().toISOString(),
    };

    await logAdminAction(db, user.id, "gdpr_export", data.userId, "User data exported");

    return exportData;
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      reason: z.string().min(1).max(300),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    // Archive user data (excluding password_hash — never persist auth secrets in the archive)
    const userResult = await db.query<{
      id: string;
      email: string;
      username: string;
      mascot: string;
      is_admin: boolean;
      bio: string | null;
      created_at: string;
    }>(`SELECT id, email, username, mascot, is_admin, bio, created_at FROM users WHERE id = $1`, [
      data.userId,
    ]);

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const userData = userResult.rows[0];
    const emailHash = createHash("sha256").update(userData.email).digest("hex");

    // Create archive record
    await db.query(
      `INSERT INTO deleted_users_archive (user_id, email_hash, data_json, retention_until)
       VALUES ($1, $2, $3, now() + interval '2 years')`,
      [data.userId, emailHash, JSON.stringify(userData)],
    );

    // Anonymize user data
    await db.query(
      `UPDATE users
       SET email = 'deleted-' || id::text || '@deleted.local',
           username = 'deleted_' || substring(id::text, 1, 8),
           is_admin = false
       WHERE id = $1`,
      [data.userId],
    );

    // Revoke any active sessions so a deleted account can't keep using the app
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [data.userId]);

    await logAdminAction(db, user.id, "user_deleted", data.userId, `Reason: ${data.reason}`);
  });
