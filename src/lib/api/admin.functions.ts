import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

  // Revenue metrics
  const revenueResult = await db.query<{
    total24h: number;
    total7d: number;
    total30d: number;
    platformFees24h: number;
  }>(
    `SELECT
      COALESCE(SUM(CASE WHEN p.created_at >= $1 THEN p.price_paid ELSE 0 END), 0)::numeric AS total24h,
      COALESCE(SUM(CASE WHEN p.created_at >= $2 THEN p.price_paid ELSE 0 END), 0)::numeric AS total7d,
      COALESCE(SUM(CASE WHEN p.created_at >= $3 THEN p.price_paid ELSE 0 END), 0)::numeric AS total30d,
      COALESCE(SUM(CASE WHEN ct.created_at >= $1 AND ct.type = 'platform_fee' THEN ABS(ct.amount) ELSE 0 END), 0)::numeric AS platformFees24h
    FROM purchases p
    LEFT JOIN credit_transactions ct ON ct.created_at >= $1`,
    [day1, day7, day30]
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
    [day1]
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
    FROM prompt_listings LIMIT 1`
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
    LIMIT 50`
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
    ORDER BY report_count DESC, r.created_at DESC`
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

export const searchListings = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    search: z.string().optional().default(""),
    status: z.enum(["all", "published", "flagged", "removed", "draft"]).optional().default("all"),
  }))
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
  .inputValidator(z.object({
    listingId: z.string().uuid(),
    status: z.enum(["published", "flagged", "removed"]),
  }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();
    await db.query(
      "UPDATE prompt_listings SET status = $1 WHERE id = $2",
      [data.status, data.listingId]
    );

    await logAdminAction(db, user.id, "moderate_listing", data.listingId, `Status changed to ${data.status}`);
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
  .inputValidator(z.object({
    search: z.string().optional().default(""),
  }))
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
  .inputValidator(z.object({
    userId: z.string().uuid(),
    amount: z.number(),
    reason: z.string().min(1).max(300),
  }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Unauthorized");
    }

    const db = getDb();

    // Initialize user_credits if needed
    await db.query(
      `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [data.userId, 0]
    );

    // Update balance
    await db.query(
      `UPDATE user_credits SET balance = balance + $1, updated_at = now() WHERE user_id = $2`,
      [data.amount, data.userId]
    );

    // Log transaction
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, note)
       VALUES ($1, $2, 'bonus', $3)`,
      [data.userId, data.amount, data.reason]
    );

    // Log admin action
    await logAdminAction(db, user.id, "credits_adjusted", data.userId, `${data.amount > 0 ? '+' : ''}${data.amount} credits: ${data.reason}`);
  });
