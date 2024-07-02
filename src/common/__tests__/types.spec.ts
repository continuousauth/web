import { projectIsMissingConfig } from '../types';

describe('projectIsMissingConfig', () => {
  it('should return false for configured project', () => {
    expect(
      projectIsMissingConfig({
        responder_slack: {},
        requester_circleCI: {},
        requester_gitHub: null,
      }),
    ).toBe(false);
  });

  it('should return true if no requester is configured', () => {
    expect(
      projectIsMissingConfig({
        responder_slack: {},
        requester_circleCI: null,
        requester_gitHub: null,
      }),
    ).toBe(true);
  });

  it('should return true if no responder is configured', () => {
    expect(
      projectIsMissingConfig({
        responder_slack: null,
        requester_circleCI: {},
        requester_gitHub: null,
      }),
    ).toBe(true);
  });

  it('should return true if nothing is configured', () => {
    expect(
      projectIsMissingConfig({
        responder_slack: null,
        requester_circleCI: null,
        requester_gitHub: null,
      }),
    ).toBe(true);
  });
});
