import { generateNewSecret, sanitizeProject } from '../_safe';

describe('generateNewSecret', () => {
  it('generates a secret of the given length', () => {
    expect(generateNewSecret(123)).toHaveLength(123);
  });

  it('will not generate a secret longer than 256', () => {
    expect(() => generateNewSecret(500)).toThrow();
  });
});

describe('sanitizeProject', () => {
  it('removes all bad properties', () => {
    expect(sanitizeProject({} as any)).toStrictEqual({});
  });
});
