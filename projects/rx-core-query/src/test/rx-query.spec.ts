import {
  getDefaultRxQueryOption,
  RxQuery,
  RxQueryNotifier,
  RxQueryOption,
  RxState,
  shallowEqualDepth,
} from 'rx-core-query';
import { map, of, Subject, throwError } from 'rxjs';
import { defaultQuery } from '../lib/rx-const';
import Expect = jest.Expect;

const getCurrentStatus = (store: any) => {
  return store.getCurrentCache().getCurrentData();
};

const notifier: RxQueryNotifier = {
  destroy$: new Subject(),
  online$: new Subject(),
  windowActive$: new Subject(),
  isDev: true,
};

const createRxQuery = (
  params: RxQueryOption,
  option?: {
    notifiers?: RxQueryNotifier;
    cacheState?: RxState;
    keepRefetchInterval?: boolean;
  },
) => {
  const store = new RxQuery(params, option?.notifiers || notifier, option?.cacheState) as any;
  if (!option?.keepRefetchInterval) {
    store.refetchInterval$.complete();
  }
  return store as any;
};
describe('getDefaultRxQueryOption', () => {
  const rxconst = {
    maxCaching: 50,
    defaultCaching: 0,
    defaultRetry: 2,
    defaultRetryDelay: 3,
    defaultInterval: 24 * 3600,
    staleTime: 60,
    minRefetchTime: 5,
    minValidReconnectTime: 12,
    minValidFocusTime: 60,
  };

  it('check default props1', () => {
    const option = {
      key: 'store',
      initState: {},
      retry: 0,
      retryDelay: 0,
      refetchInterval: 0,
      minValidFocusTime: 0,
      minValidReconnectTime: 0,
    };
    const fixedOption = getDefaultRxQueryOption(option, rxconst);
    expect(fixedOption.key).toBe(option.key);
    expect(fixedOption.query).toBe(defaultQuery);
    expect(fixedOption.initState).toBe(option.initState);
    expect(fixedOption.prefetch).toBe(null);
    expect(fixedOption.isEqual).toBe(shallowEqualDepth);
    expect(fixedOption.keepAlive).toBe(false);
    expect(fixedOption.retry).toBe(0);
    expect(fixedOption.retryDelay).toBe(0);
    expect(fixedOption.dataEasing).toBe(false);
    expect(fixedOption.paramToCachingKey).toBe(undefined);
    expect(fixedOption.refetchOnEmerge).toBe(true);
    expect(fixedOption.refetchOnReconnect).toBe(true);
    expect(fixedOption.refetchOnBackground).toBe(false);
    expect(fixedOption.minValidFocusTime).toBe(0);
    expect(fixedOption.minValidReconnectTime).toBe(0);
    expect(fixedOption.staleTime).toBe(rxconst.staleTime);
    expect(fixedOption.refetchInterval).toBe(0);
    expect(fixedOption.caching).toBe(0);
  });

  it('check default min max', () => {
    const option = {
      key: 'store',
      initState: {},
      refetchInterval: 2,
      paramToCachingKey: 'hello',
      refetchOnEmerge: false,
      refetchOnReconnect: false,
      refetchOnBackground: false,
    };
    const fixedOption = getDefaultRxQueryOption(option, rxconst);
    expect(fixedOption.query).toBe(defaultQuery);
    expect(fixedOption.retry).toBe(2);
    expect(fixedOption.retryDelay).toBe(3);
    expect(typeof fixedOption.paramToCachingKey).toBe('function');
    expect(fixedOption.refetchOnEmerge).toBe(false);
    expect(fixedOption.refetchOnReconnect).toBe(false);
    expect(fixedOption.refetchOnBackground).toBe(false);
    expect(fixedOption.minValidFocusTime).toBe(rxconst.minValidFocusTime);
    expect(fixedOption.minValidReconnectTime).toBe(rxconst.minValidReconnectTime);
    expect(fixedOption.staleTime).toBe(rxconst.staleTime);
    expect(fixedOption.refetchInterval).toBe(5);
    expect(fixedOption.caching).toBe(0);
  });
});

describe('RxQuery options for state', () => {
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

  it('RxQuery prefetch works', () => {
    const store = createRxQuery({ ...defaultOption, query, prefetch: { param } }) as any;
    jest.runAllTimers();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).data).toBe(res);
    store.destroy();
  });

  it('RxQuery keepAlive works', () => {
    const store = createRxQuery({
      ...defaultOption,
      query,
      keepAlive: true,
      prefetch: { param },
    });
    jest.runAllTimers();
    store.destroy();
    expect(store.cacheState.alive).toBe(true);

    const store1 = createRxQuery(
      {
        ...defaultOption,
        keepAlive: false,
        prefetch: { param },
      },
      {
        cacheState: store.cacheState,
      },
    );
    expect(getCurrentStatus(store1).data).toBe(res);
    store1.destroy();
    expect(store.cacheState.alive).toBe(false);

    const store2 = createRxQuery(
      { ...defaultOption, keepAlive: false, prefetch: { param } },
      {
        cacheState: store.cacheState,
      },
    );
    expect(getCurrentStatus(store2).data).toBe(defaultOption.initState);
    store2.destroy();
  });
});

describe('RxQuery: retry', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });
  const defaultOption = {
    key: 'query retry',
    initState: {},
  };
  it('RxQuery Error: retry works', () => {
    const param = {};
    const retry = 3;
    const mockFn = jest.fn((m: any) => {});
    const query = (v: any) =>
      of(v).pipe(
        map((p) => {
          mockFn(p);
          throw Error('error');
        }),
      );
    const store = createRxQuery({ ...defaultOption, query, retry, retryDelay: 0 });
    store.fetch(param);
    jest.runAllTimers();
    expect(mockFn).toHaveBeenCalledTimes(retry + 1);
    expect(mockFn).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).error).toBeInstanceOf(Error);
    store.destroy();
  });

  it('RxQuery Error: retry does not happen with 0', () => {
    const param = {};
    const retry = 0;
    const mockFn = jest.fn((m: any) => m);
    const query = (v: any) =>
      of(v).pipe(
        map((p) => {
          mockFn(p);
          throw Error('error');
        }),
      );
    const store = createRxQuery({ ...defaultOption, query, retry, retryDelay: 0 });
    store.fetch(param);
    jest.runAllTimers();
    expect(mockFn).toHaveBeenCalledTimes(retry + 1);
    expect(mockFn).toHaveBeenCalledWith(param);
    expect(getCurrentStatus(store).error).toBeInstanceOf(Error);
    store.destroy();
  });
});

describe('RxQuery: fetch', () => {
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

    const store = createRxQuery({ ...option, query });
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

describe('RxQuery: mutate', () => {
  const option = {
    key: 'store fetch',
    initState: { id: 0 },
    retry: 0,
    retryDelay: 0,
  };

  it('change status by mutate should cause error', () => {
    const store = createRxQuery(option);
    const status: any[] = [];
    const select: any[] = [];
    store.getCurrentCache().untrustedData = false;
    store.status().subscribe((s: any) => {
      status.push(s);
    });
    store.select().subscribe((s: any) => {
      select.push(s);
    });
    store.mutate((state: { id: number }) => {
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

describe('RxQuery: refetchInterval', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const param = {};
  const res = 'hello';
  const query = jest.fn().mockImplementation(() => of(res));
  const option = {
    key: 'store',
    initState: {},
    refetchInterval: 2,
    paramToCachingKey: 'hello',
    refetchOnEmerge: false,
    refetchOnReconnect: false,
    refetchOnBackground: false,
    query,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refetchInterval$ should be called with interval milliseconds after fetch', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3 });
    const spy = jest.spyOn(store.refetchInterval$, 'next');
    store.fetch(param);
    jest.runAllTimers();
    expect(spy.mock.calls).toEqual([[3000]]);
  });
});

describe('RxQuery: refetch should not call query when', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const param = {};
  const res = 'hello';
  const query = jest.fn().mockImplementation(() => of(res));
  const option = {
    key: 'store',
    initState: {},
    refetchInterval: 2,
    paramToCachingKey: 'hello',
    refetchOnEmerge: false,
    refetchOnReconnect: false,
    refetchOnBackground: false,
    query,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refetchDisabled', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3, staleTime: 60 });
    const triggerSpy = jest.spyOn(store.trigger$, 'next');
    const refetchIntervalSpy = jest.spyOn(store.refetchInterval$, 'next');
    store.fetch(param);
    jest.runAllTimers();
    triggerSpy.mockClear();
    refetchIntervalSpy.mockClear();
    jest.advanceTimersByTime(61000);

    store.refetchDisabled = true;
    store.refetch();
    jest.runAllTimers();
    expect(triggerSpy).toHaveBeenCalledTimes(0);
    expect(refetchIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('onBackground without forcedBackgroundRefetch', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3, staleTime: 60 });
    const triggerSpy = jest.spyOn(store.trigger$, 'next');
    const refetchIntervalSpy = jest.spyOn(store.refetchInterval$, 'next');
    store.fetch(param);
    jest.runAllTimers();
    triggerSpy.mockClear();
    refetchIntervalSpy.mockClear();
    jest.advanceTimersByTime(61000);

    store.isOnBackground = true;
    store.refetch();
    jest.runAllTimers();
    expect(triggerSpy).toHaveBeenCalledTimes(0);
    expect(refetchIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('isLoading for current cache', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3, staleTime: 60 });
    const triggerSpy = jest.spyOn(store.trigger$, 'next');
    const refetchIntervalSpy = jest.spyOn(store.refetchInterval$, 'next');
    store.fetch(param);
    jest.runAllTimers();
    triggerSpy.mockClear();
    refetchIntervalSpy.mockClear();
    jest.advanceTimersByTime(61000);

    store.getCurrentCache().loading = true;
    store.refetch();
    jest.runAllTimers();
    expect(triggerSpy).toHaveBeenCalledTimes(0);
    expect(refetchIntervalSpy).toHaveBeenCalledTimes(0);
  });

  it('not fetched cache', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3, staleTime: 60 });
    const triggerSpy = jest.spyOn(store.trigger$, 'next');
    const refetchIntervalSpy = jest.spyOn(store.refetchInterval$, 'next');

    store.refetch();
    jest.runAllTimers();
    expect(triggerSpy).toHaveBeenCalledTimes(0);
    expect(refetchIntervalSpy).toHaveBeenCalledTimes(0);
  });

  it('still valid', () => {
    const store = createRxQuery({ ...option, refetchInterval: 3, staleTime: 60 });
    const triggerSpy = jest.spyOn(store.trigger$, 'next');
    const refetchIntervalSpy = jest.spyOn(store.refetchInterval$, 'next');
    store.fetch(param);
    jest.runAllTimers();
    triggerSpy.mockClear();
    refetchIntervalSpy.mockClear();

    store.refetch();
    jest.runAllTimers();
    expect(triggerSpy).toHaveBeenCalledTimes(0);
    expect(refetchIntervalSpy).toHaveBeenCalledTimes(0);
  });
});
