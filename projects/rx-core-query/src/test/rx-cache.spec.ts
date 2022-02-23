import { RxCache } from '../lib/rx-cache';
import { take } from 'rxjs';

describe('RxCache initState', () => {
  const initData = { name: 'kelly' };
  const initState = {
    loading: false,
    ts: 0,
    error: null,
    data: initData,
    untrustedData: true,
  };
  let cache!: RxCache;
  beforeEach(() => {
    cache = new RxCache('key', initData);
  });

  it('RxCache.getCurrentData', () => {
    expect(cache.getCurrentData()).toEqual(initState);
  });

  it('RxCache.status$', (done) => {
    cache.notification$.pipe(take(1)).subscribe((state) => {
      expect(state).toEqual(initState);
      done();
    });
  });
});

describe('RxCache notifyChange calls', () => {
  const initData = { name: 'kelly' };
  let cache!: RxCache;
  let notifySpy!: any;
  const now = Date.now();

  beforeEach(() => {
    jest.spyOn(global.Date, 'now').mockImplementationOnce(() => now);
    cache = new RxCache('key', initData);
    notifySpy = jest.spyOn(cache as unknown as { notifyChange: () => void }, 'notifyChange');
  });

  it('notification$ triggers: prepareFetching', () => {
    cache.prepareFetching();
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(cache.getCurrentData()).toEqual({
      ts: 0,
      error: null,
      loading: true,
      data: initData,
      untrustedData: true,
    });
  });

  it('notification$ triggers: onSuccess', () => {
    const newData = { name: 'Kelly2' };
    cache.onSuccess(newData);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(cache.getCurrentData()).toEqual({
      ts: now,
      error: null,
      loading: false,
      data: newData,
      untrustedData: false,
    });
  });

  it('notification$ triggers: onError', () => {
    const error = new Error('dkdkdk');
    cache.onError(error);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(cache.getCurrentData()).toEqual({
      ts: 0,
      error,
      loading: false,
      data: initData,
      untrustedData: true,
    });
  });

  it('notification$ triggers: onMutate', () => {
    const newData = { name: 'Kelly2' };
    (cache as any).loading = true;
    expect(cache.onMutate(() => newData)).toEqual(false);
    (cache as any).loading = false;
    expect(cache.onMutate(() => newData)).toEqual(true);
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(cache.getCurrentData()).toEqual({
      ts: 0,
      error: null,
      loading: false,
      data: newData,
      untrustedData: true,
    });
  });
});

describe('RxCache unNotify', () => {
  const initData = { name: 'kelly' };
  const cache = new RxCache('key', initData);
  it('notification stops when with unNotify', ()=>{
    const subs = cache.notification$.subscribe();
    expect(subs.closed).toBe(false);
    cache.unNotify();
    expect(subs.closed).toBe(true);
  })
});
