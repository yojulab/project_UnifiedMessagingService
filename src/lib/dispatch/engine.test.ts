import { describe, expect, it } from 'vitest';
import { decideStatus } from './engine';

describe('decideStatus', () => {
  it.each([
    [10, 0, 'COMPLETED'],
    [0, 0, 'COMPLETED'],
    [9, 1, 'PARTIAL'],
    [5, 5, 'PARTIAL'],
    [4, 6, 'FAILED'],
    [0, 3, 'FAILED'],
  ])('sent=%i failed=%i → %s', (s, f, expected) => expect(decideStatus(s, f)).toBe(expected));
});
