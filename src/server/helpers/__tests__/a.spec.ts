import * as debug from 'debug';
import { Request } from 'jest-express/lib/request';
import { Response } from 'jest-express/lib/response';

import { createA } from '../a';

describe('createA', () => {
  it('should return a function', () => {
    expect(typeof createA(null as any)).toBe('function');
  });

  describe('a', () => {
    let d: debug.Debugger;
    let a: ReturnType<typeof createA>;

    beforeEach(() => {
      d = debug('cfa:test');
      a = createA(d);
    });

    it('should be a function', () => {
      expect(typeof a).toBe('function');
    });

    it('should return a function', () => {
      expect(typeof a(null as any)).toBe('function');
    });

    it('should do nothing if the handler exits cleanly', async () => {
      const fakeReq = new Request();
      const fakeRes = new Response();
      await a(async (req, res) => {
        res.json(123);
      })(fakeReq as any, fakeRes as any, null as any);
      expect(fakeRes.status).not.toBeCalled();
      expect(fakeRes.json).toBeCalledWith(123);
    });

    it('should send a 500 if the handle fails', async () => {
      const fakeReq = new Request();
      const fakeRes = new Response();
      await a(async () => {
        throw 'whoops';
      })(fakeReq as any, fakeRes as any, null as any);
      expect(fakeRes.status).toHaveBeenCalledWith(500);
      expect(fakeRes.json).toHaveBeenCalled();
    });
  });
});
