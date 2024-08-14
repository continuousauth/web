import { cx, defaultFetchInit, defaultBodyReader, projectHasAnyConfig } from '../utils';

describe('cx', () => {
  it('should join provided classes', () => {
    expect(cx('class1', 'class2')).toMatchInlineSnapshot(`"class1 class2"`);
  });

  it('should ignore null and undefined classes', () => {
    expect(cx('class1', null, 'class3', undefined, 'class5')).toMatchInlineSnapshot(
      `"class1 class3 class5"`,
    );
  });
});

describe('projectHasAnyConfig', () => {
  it('should return true if the project has circleci configured', () => {
    expect(projectHasAnyConfig({ requester_circleCI: true } as any)).toBe(true);
  });

  it('should return true if the project has github configured', () => {
    expect(projectHasAnyConfig({ requester_gitHub: true } as any)).toBe(true);
  });

  it('should return true if the project has slack configured', () => {
    expect(projectHasAnyConfig({ responder_slack: true } as any)).toBe(true);
  });

  it('should return false if the project has nothing configured', () => {
    expect(projectHasAnyConfig({ random_key: 123 } as any)).toBe(false);
  });
});

describe('memoized react hook inputs', () => {
  describe('defaultFetchInit', () => {
    it('should have no keys', () => {
      expect(Object.keys(defaultFetchInit)).toHaveLength(0);
    });
  });

  describe('defaultBodyReader', () => {
    it('should call json on the response', async () => {
      expect(
        await defaultBodyReader({
          json() {
            return Promise.resolve(123);
          },
        }),
      ).toBe(123);
    });
  });
});
