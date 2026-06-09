export interface GamificationStats {
  listingsCount: number;
  salesCount: number;
  savesReceived: number;
  reviewsWritten: number;
}

export interface Badge {
  id: string;
  label: string;
  icon: string;
  earned: boolean;
}

export const CREDIT_RATES = {
  publishBonus: 2.00,
  copyAuthorShare: 0.07,   // 70% of 0.10 copy reward
  copyPlatformFee: 0.03,   // 30% platform keeps
  purchaseAuthorShare: 0.70,
  purchasePlatformFee: 0.30,
  welcomeBonus: 5.00,
};

export function computeXP(stats: GamificationStats): number {
  return (
    stats.listingsCount * 100 +
    stats.salesCount * 500 +
    stats.savesReceived * 50 +
    stats.reviewsWritten * 75
  );
}

export function computeLevel(xp: number): { level: number; xpInLevel: number; xpToNext: number } {
  const level = Math.floor(xp / 1000) + 1;
  return { level, xpInLevel: xp % 1000, xpToNext: 1000 };
}

export function computeBadges(stats: GamificationStats): Badge[] {
  return [
    {
      id: "first_star",
      label: "First Star",
      icon: "⭐",
      earned: stats.savesReceived >= 1,
    },
    {
      id: "creator",
      label: "Creator",
      icon: "🎨",
      earned: stats.listingsCount >= 1,
    },
    {
      id: "first_sale",
      label: "First Sale",
      icon: "💰",
      earned: stats.salesCount >= 1,
    },
    {
      id: "hot_streak",
      label: "Hot Streak",
      icon: "🔥",
      earned: stats.savesReceived >= 5,
    },
    {
      id: "top_seller",
      label: "Top Seller",
      icon: "👑",
      earned: stats.salesCount >= 10,
    },
  ];
}
