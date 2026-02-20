import { describe, it, expect } from 'vitest';
import {
  VALIDATION, COIN_BASE_EARNING, COIN_DAILY_LIMIT, COIN_POST_LIMIT,
  COIN_MIN_WITHDRAWAL, COIN_TO_TRY_RATE, MIN_READ_DURATION, MIN_READ_PERCENTAGE,
  GIFT_TYPES, SPAM_THRESHOLDS, RATE_LIMITS, MILESTONES,
} from '@/lib/constants';

describe('Validation Constants', () => {
  describe('Username validation', () => {
    const { pattern, min, max } = VALIDATION.username;

    it('accepts valid usernames', () => {
      expect(pattern.test('ali')).toBe(true);
      expect(pattern.test('john_doe')).toBe(true);
      expect(pattern.test('user.name')).toBe(true);
      expect(pattern.test('UserName123')).toBe(true);
    });

    it('rejects invalid usernames', () => {
      expect(pattern.test('ab')).toBe(false); // too short
      expect(pattern.test('.username')).toBe(false); // starts with dot
      expect(pattern.test('username.')).toBe(false); // ends with dot
      expect(pattern.test('user..name')).toBe(false); // consecutive dots
      expect(pattern.test('user__name')).toBe(false); // consecutive underscores
    });

    it('has correct length bounds', () => {
      expect(min).toBe(3);
      expect(max).toBe(15);
    });
  });

  describe('Password validation', () => {
    it('has correct length bounds', () => {
      expect(VALIDATION.password.min).toBe(6);
      expect(VALIDATION.password.max).toBe(128);
    });
  });

  describe('Name validation', () => {
    const { pattern } = VALIDATION.name;

    it('accepts Unicode letters', () => {
      expect(pattern.test('Ali')).toBe(true);
      expect(pattern.test('Mehmet Ali')).toBe(true);
    });

    it('rejects numbers and special chars', () => {
      expect(pattern.test('Ali123')).toBe(false);
      expect(pattern.test('Ali@')).toBe(false);
    });
  });
});

describe('Coin Economy', () => {
  it('has sane earning values', () => {
    expect(COIN_BASE_EARNING).toBeGreaterThan(0);
    expect(COIN_DAILY_LIMIT).toBeGreaterThan(COIN_BASE_EARNING);
    expect(COIN_POST_LIMIT).toBeGreaterThan(COIN_DAILY_LIMIT);
  });

  it('has valid exchange rate', () => {
    expect(COIN_TO_TRY_RATE).toBe(0.10);
    expect(COIN_MIN_WITHDRAWAL).toBe(100);
    // Min withdrawal = 100 * 0.10 = 10 TL
    expect(COIN_MIN_WITHDRAWAL * COIN_TO_TRY_RATE).toBe(10);
  });

  it('has correct reading thresholds', () => {
    expect(MIN_READ_DURATION).toBe(30);
    expect(MIN_READ_PERCENTAGE).toBe(40);
  });
});

describe('Gift Types', () => {
  it('has all required gift types', () => {
    expect(GIFT_TYPES.coffee).toBeDefined();
    expect(GIFT_TYPES.heart).toBeDefined();
    expect(GIFT_TYPES.star).toBeDefined();
    expect(GIFT_TYPES.diamond).toBeDefined();
  });

  it('has increasing coin values', () => {
    expect(GIFT_TYPES.coffee.coins).toBeLessThan(GIFT_TYPES.heart.coins);
    expect(GIFT_TYPES.heart.coins).toBeLessThan(GIFT_TYPES.star.coins);
    expect(GIFT_TYPES.star.coins).toBeLessThan(GIFT_TYPES.diamond.coins);
  });
});

describe('Spam Thresholds', () => {
  it('has increasing severity', () => {
    expect(SPAM_THRESHOLDS.moderation).toBeLessThan(SPAM_THRESHOLDS.earningStop);
    expect(SPAM_THRESHOLDS.earningStop).toBeLessThan(SPAM_THRESHOLDS.autoModeration);
    expect(SPAM_THRESHOLDS.autoModeration).toBeLessThan(SPAM_THRESHOLDS.autoBlock);
  });
});

describe('Rate Limits', () => {
  it('has API rate limit configured', () => {
    expect(RATE_LIMITS.api.limit).toBe(60);
    expect(RATE_LIMITS.api.window).toBe(60_000);
  });

  it('has comment rate limits', () => {
    expect(RATE_LIMITS.comment_user.perMinute).toBeLessThan(RATE_LIMITS.comment_user.perHour);
    expect(RATE_LIMITS.comment_user.perHour).toBeLessThan(RATE_LIMITS.comment_user.perDay);
  });
});

describe('Milestones', () => {
  it('has correct milestone values', () => {
    expect(MILESTONES).toEqual([1000, 10000, 100000, 1000000, 10000000]);
  });

  it('is sorted ascending', () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i]).toBeGreaterThan(MILESTONES[i - 1]);
    }
  });
});
