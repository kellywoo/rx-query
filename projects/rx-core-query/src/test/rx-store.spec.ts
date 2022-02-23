import { RxQueryNotifier, RxStore, shallowEqualDepth } from 'rx-core-query';
import { map, of, Subject, throwError } from 'rxjs';
import Expect = jest.Expect;

const getCurrentStatus = (store: any) => {
  return store.cacheState.getCurrentCache().getCurrentData();
};
const notifier: RxQueryNotifier = {
  destroy$: new Subject(),
  online$: new Subject(),
  windowActive$: new Subject(),
};

describe('RxStore default props', () => {
  const option = {
    key: 'store',
    initState: {},
    retry: 0,
    retryDelay: 0,
  };

  it('check default props & state', () => {
    const store = new RxStore(option, notifier) as any;
    expect(store.key).toBe(option.key);
    expect(store.initState).toBe(option.initState);
    expect(store.keepAlive).toBe(false);
    expect(store.isEqual).toBe(shallowEqualDepth);
    expect(store.retry).toBe(0);
    expect(store.retryDelay).toBe(0);
    expect(typeof store.query).toBe('function');
    expect(store.cacheState).toBeTruthy();
    expect(store.cacheState.getCurrentCache()).toBe(store.cacheState.initCache);
    expect(getCurrentStatus(store).data).toBe(option.initState);
    store.destroy();
  });
});

describe('RxStore options for state', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  const defaultOption = {
    key: 'store state',
    initState: {},
  };

  const param = {};
  const res = 'hello';
  const query = jest.fn().mockImplementation(() => of(res));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('RxStore prefetch works', () => {
    const store = new RxStore({ ...defaultOption, query, prefetch: { param } }, notifier) as any;
    jest.runAllTimers();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).data).toBe(res);
    store.destroy();
  });

  it('RxStore keepAlive works', () => {
    const store = new RxStore(
      { ...defaultOption, query, keepAlive: true, prefetch: { param } },
      notifier,
    ) as any;
    jest.runAllTimers();
    store.destroy();
    const store1 = new RxStore(
      { ...defaultOption, keepAlive: false, prefetch: { param } },
      notifier,
      store.cacheState,
    ) as any;
    expect(getCurrentStatus(store1).data).toBe(res);
    store1.destroy();
    const store2 = new RxStore(
      { ...defaultOption, keepAlive: false, prefetch: { param } },
      notifier,
      store.cacheState,
    ) as any;
    expect(getCurrentStatus(store2).data).toBe(defaultOption.initState);
    store2.destroy();
  });
});

describe('RxStore: retry', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  const defaultOption = {
    key: 'store retry',
    initState: {},
  };
  it('RxStore Error: retry works', () => {
    const param = {};
    const retry = 3;
    const mockFn = jest.fn((m) => m);
    const query = (v: any) =>
      of(v).pipe(
        map((p) => {
          mockFn(p);
          throw Error('error');
        }),
      );
    const store = new RxStore({ ...defaultOption, query, retry, retryDelay: 0 }, notifier) as any;
    store.fetch(param);
    jest.runAllTimers();
    expect(mockFn).toHaveBeenCalledTimes(retry + 1);
    expect(mockFn).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).error).toBeInstanceOf(Error);
    store.destroy();
  });

  it('RxStore Error: retry does not happen with 0', () => {
    const param = {};
    const retry = 0;
    const mockFn = jest.fn((m) => m);
    const query = (v: any) =>
      of(v).pipe(
        map((p) => {
          mockFn(p);
          throw Error('error');
        }),
      );
    const store = new RxStore({ ...defaultOption, query, retry, retryDelay: 0 }, notifier) as any;
    store.fetch(param);
    jest.runAllTimers();
    expect(mockFn).toHaveBeenCalledTimes(retry + 1);
    expect(mockFn).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).error).toBeInstanceOf(Error);
    store.destroy();
  });
});

describe('RxStore: fetch', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  const option = {
    key: 'store fetch',
    initState: {},
    retry: 0,
    retryDelay: 0,
  };

  it('change status by fetch', () => {
    const param = {};

    const now = Date.now();
    jest.spyOn(global.Date, 'now').mockImplementationOnce(() => now);

    const successRes = { success: true };
    let first = true;
    const query = (v: any) => {
      if (first) {
        first = false;
        return throwError(() => {
          throw Error('error');
        });
      } else {
        return of(successRes);
      }
    };

    const store = new RxStore({ ...option, query }, notifier);
    const status: any[] = [];
    const select: any[] = [];
    const response: any[] = [];
    store.status().subscribe((s: any) => {
      status.push(s);
    });
    store.select().subscribe((s: any) => {
      select.push(s);
    });
    store.response().subscribe((s: any) => {
      response.push(s);
    });
    store.fetch(param);
    jest.runAllTimers();
    store.fetch(param);
    jest.runAllTimers();
    // status
    expect(status.length).toBe(5);
    expect(status[0]).toEqual({
      ts: 0,
      error: null,
      data: option.initState,
      untrustedData: true,
      loading: false,
    });
    expect(status[1]).toEqual({
      ts: 0,
      error: null,
      data: option.initState,
      untrustedData: true,
      loading: true,
    });
    expect(status[2]).toEqual({
      ts: 0,
      error: (expect as unknown as Expect).any(Error),
      data: option.initState,
      untrustedData: true,
      loading: false,
    });
    expect(status[3]).toEqual({
      ts: 0,
      error: null,
      data: option.initState,
      untrustedData: true,
      loading: true,
    });
    expect(status[4]).toEqual({
      ts: now,
      error: null,
      data: successRes,
      untrustedData: false,
      loading: false,
    });
    // select
    expect(select.length).toBe(2);
    expect(select[0]).toBe(option.initState);
    expect(select[1]).toBe(successRes);
    // response
    expect(response.length).toBe(2);
    expect(response[0]).toEqual({
      type: 'error',
      refetch: false,
      data: (expect as unknown as Expect).any(Error),
      param,
    });
    expect(response[1]).toEqual({
      type: 'success',
      refetch: false,
      data: successRes,
      param,
    });
    store.destroy();
  });
});

describe('RxStore: mutate', () => {
  const option = {
    key: 'store fetch',
    initState: { id: 0 },
    retry: 0,
    retryDelay: 0,
  };

  it('change status by fetch', () => {
    const store = new RxStore<{ id: number }>(option, notifier);
    const status: any[] = [];
    const select: any[] = [];
    store.status().subscribe((s: any) => {
      status.push(s);
    });
    store.select().subscribe((s: any) => {
      select.push(s);
    });
    store.mutate((state) => {
      return { id: state.id + 1 };
    });
    store.mutate((state: { id: number }) => {
      return { id: state.id + 1 };
    });
    expect(status.length).toBe(3);
    [0, 1, 2].forEach((v) => {
      expect(status[v]).toEqual({
        ts: 0,
        error: null,
        data: { id: v },
        untrustedData: true,
        loading: false,
      });
    });
    expect(select.length).toBe(3);
    [0, 1, 2].forEach((v) => {
      expect(select[v]).toEqual({ id: v });
    });
    store.destroy();
  });
});
