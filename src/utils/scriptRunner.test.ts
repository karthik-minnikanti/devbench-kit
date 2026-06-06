import { describe, expect, it } from 'vitest';
import { executeScript } from './scriptRunner';

describe('executeScript', () => {
  it('runs empty scripts successfully', () => {
    const result = executeScript('', {});
    expect(result.success).toBe(true);
    expect(result.logs).toEqual([]);
  });

  it('sets environment variables through pm API', () => {
    const context = { environment: {} as Record<string, string> };
    const result = executeScript('pm.environment.set("foo", "bar");', context);

    expect(result.success).toBe(true);
    expect(result.updatedContext?.environment?.foo).toBe('bar');
  });

  it('returns errors for invalid scripts', () => {
    const result = executeScript('throw new Error("boom");', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });
});
