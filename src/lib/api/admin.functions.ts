import { createServerFn } from "@tanstack/react-start";
import { getDb } from "../db.server";
import { getSessionUser } from "../auth.server";

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
