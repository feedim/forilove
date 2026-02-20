import { describe, it, expect } from 'vitest';

// Test the calculateCoinEarning logic directly
// (Extracted from the view route for testability)

function calculateCoinEarning(opts: {
  readPercentage: number;
  hasLiked: boolean;
  hasCommented: boolean;
  hasSaved: boolean;
  hasShared: boolean;
  authorVerified: boolean;
  authorTrustLevel: number;
}): number {
  let coins = 1; // COIN_BASE_EARNING

  // Quality multiplier based on read depth
  if (opts.readPercentage >= 80) coins *= 2.0;
  else if (opts.readPercentage >= 60) coins *= 1.5;

  // Engagement bonuses
  if (opts.hasLiked) coins += 0.5;
  if (opts.hasCommented) coins += 1.0;
  if (opts.hasSaved) coins += 0.5;
  if (opts.hasShared) coins += 1.0;

  // Author multipliers
  if (opts.authorVerified) coins *= 1.2;
  else if (opts.authorTrustLevel >= 2) coins *= 1.1;

  return Math.round(coins);
}

describe('Coin Earning Algorithm', () => {
  const baseOpts = {
    readPercentage: 50,
    hasLiked: false,
    hasCommented: false,
    hasSaved: false,
    hasShared: false,
    authorVerified: false,
    authorTrustLevel: 0,
  };

  it('returns base earning for minimum qualified read', () => {
    expect(calculateCoinEarning(baseOpts)).toBe(1);
  });

  it('applies 1.5x multiplier for 60-80% read depth', () => {
    expect(calculateCoinEarning({ ...baseOpts, readPercentage: 65 })).toBe(2); // 1.5 rounded
  });

  it('applies 2x multiplier for 80%+ read depth', () => {
    expect(calculateCoinEarning({ ...baseOpts, readPercentage: 90 })).toBe(2);
  });

  it('adds engagement bonuses', () => {
    // All engagement: +0.5 + 1.0 + 0.5 + 1.0 = +3.0, total = 4.0
    const result = calculateCoinEarning({
      ...baseOpts,
      hasLiked: true,
      hasCommented: true,
      hasSaved: true,
      hasShared: true,
    });
    expect(result).toBe(4);
  });

  it('applies verified author multiplier', () => {
    // Base(1) * 1.2 = 1.2 rounded = 1
    expect(calculateCoinEarning({ ...baseOpts, authorVerified: true })).toBe(1);

    // With 80% read: 2.0 * 1.2 = 2.4 rounded = 2
    expect(calculateCoinEarning({
      ...baseOpts,
      readPercentage: 85,
      authorVerified: true,
    })).toBe(2);
  });

  it('applies trust level multiplier', () => {
    expect(calculateCoinEarning({ ...baseOpts, authorTrustLevel: 2 })).toBe(1); // 1.1 rounded
  });

  it('stacks all multipliers correctly', () => {
    // 80%+ read: 2x base = 2.0
    // All engagement: +3.0 = 5.0
    // Verified author: * 1.2 = 6.0
    const result = calculateCoinEarning({
      readPercentage: 95,
      hasLiked: true,
      hasCommented: true,
      hasSaved: true,
      hasShared: true,
      authorVerified: true,
      authorTrustLevel: 3,
    });
    expect(result).toBe(6);
  });

  it('prefers verified over trust level', () => {
    // Both set: verified wins (1.2x vs 1.1x)
    const withVerified = calculateCoinEarning({
      ...baseOpts,
      readPercentage: 85,
      hasLiked: true,
      hasCommented: true,
      authorVerified: true,
      authorTrustLevel: 3,
    });
    const withTrust = calculateCoinEarning({
      ...baseOpts,
      readPercentage: 85,
      hasLiked: true,
      hasCommented: true,
      authorVerified: false,
      authorTrustLevel: 3,
    });
    expect(withVerified).toBeGreaterThanOrEqual(withTrust);
  });
});
