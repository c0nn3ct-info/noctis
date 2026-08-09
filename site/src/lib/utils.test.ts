import { describe, expect, it } from 'vitest';
import { cn, dedupe } from './utils';

describe('cn', () => {
  it('joins classes and lets later tailwind utilities win', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', undefined, null, false, 'text-blue-500')).toBe('text-blue-500');
  });

  it('treats the M3 type scale as a single font-size group', () => {
    expect(cn('text-body-small', 'text-title-medium')).toBe('text-title-medium');
    expect(cn('text-display-large', 'text-label-small')).toBe('text-label-small');
  });

  it('keeps unrelated classes', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });
});

describe('dedupe', () => {
  it('trims entries and drops blanks', () => {
    expect(dedupe([' a ', '', '   ', 'b'])).toEqual(['a', 'b']);
  });

  it('drops case-insensitive duplicates keeping the first casing', () => {
    expect(dedupe(['Alpha', 'alpha', 'ALPHA', 'beta'])).toEqual(['Alpha', 'beta']);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupe([])).toEqual([]);
  });
});
