import { describe, it, expect } from 'vitest';
import { checkValue, checkObject, checkUrl } from '@/lib/waf';

describe('WAF - XSS Detection', () => {
  it('blocks script tags', () => {
    expect(checkValue('<script>alert("xss")</script>').blocked).toBe(true);
    expect(checkValue('<SCRIPT SRC="evil.js"></SCRIPT>').blocked).toBe(true);
  });

  it('blocks javascript: protocol', () => {
    expect(checkValue('javascript:alert(1)').blocked).toBe(true);
  });

  it('blocks event handlers', () => {
    expect(checkValue('<img onerror="alert(1)">').blocked).toBe(true);
    expect(checkValue('<div onload=alert(1)>').blocked).toBe(true);
  });

  it('blocks iframe/object/embed', () => {
    expect(checkValue('<iframe src="evil.com">').blocked).toBe(true);
    expect(checkValue('<object data="evil.swf">').blocked).toBe(true);
    expect(checkValue('<embed src="evil">').blocked).toBe(true);
  });

  it('blocks eval/Function', () => {
    expect(checkValue('eval("code")').blocked).toBe(true);
    expect(checkValue('new Function("code")').blocked).toBe(true);
  });

  it('allows normal content', () => {
    expect(checkValue('Hello world').blocked).toBe(false);
    expect(checkValue('A nice article about coding').blocked).toBe(false);
    expect(checkValue('This is a normal comment with <3').blocked).toBe(false);
  });
});

describe('WAF - SQL Injection Detection', () => {
  it('blocks UNION SELECT', () => {
    expect(checkValue("' UNION SELECT * FROM users --").blocked).toBe(true);
  });

  it('blocks OR-based injection', () => {
    expect(checkValue("' OR '1'='1").blocked).toBe(true);
    expect(checkValue("' or 1=1--").blocked).toBe(true);
  });

  it('blocks DROP/DELETE statements', () => {
    expect(checkValue('; DROP TABLE users;').blocked).toBe(true);
    expect(checkValue('; DELETE FROM profiles;').blocked).toBe(true);
  });

  it('allows normal queries and text', () => {
    expect(checkValue('Search for articles').blocked).toBe(false);
    expect(checkValue('username123').blocked).toBe(false);
  });
});

describe('WAF - LFI Detection', () => {
  it('blocks path traversal', () => {
    expect(checkValue('../../etc/passwd').blocked).toBe(true);
    expect(checkValue('../../../etc/shadow').blocked).toBe(true);
  });

  it('blocks URL-encoded traversal', () => {
    expect(checkValue('%2e%2e/etc/passwd').blocked).toBe(true);
  });

  it('blocks file protocol', () => {
    expect(checkValue('file:///etc/passwd').blocked).toBe(true);
  });

  it('allows normal paths', () => {
    expect(checkValue('/dashboard/settings').blocked).toBe(false);
    expect(checkValue('/post/my-article').blocked).toBe(false);
  });
});

describe('WAF - Object Scanning', () => {
  it('checks nested objects', () => {
    const body = {
      name: 'Normal name',
      bio: '<script>alert(1)</script>',
    };
    expect(checkObject(body).blocked).toBe(true);
    expect(checkObject(body).reason).toBe('XSS');
  });

  it('checks arrays', () => {
    const body = {
      tags: ['normal', "'; DROP TABLE posts; --"],
    };
    expect(checkObject(body).blocked).toBe(true);
  });

  it('passes clean objects', () => {
    const body = {
      name: 'John',
      bio: 'A developer from Istanbul',
      tags: ['technology', 'science'],
    };
    expect(checkObject(body).blocked).toBe(false);
  });
});

describe('WAF - URL Checking', () => {
  it('blocks malicious query parameters', () => {
    const params = new URLSearchParams({ q: '<script>alert(1)</script>' });
    expect(checkUrl('/api/search', params).blocked).toBe(true);
  });

  it('allows normal URLs', () => {
    const params = new URLSearchParams({ page: '1', sort: 'trending' });
    expect(checkUrl('/api/posts/explore', params).blocked).toBe(false);
  });
});
