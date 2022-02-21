import { INIT_CACHE_KEY, RxState } from 'rx-ng-query';
import {RxCache} from "../lib/rx-cache";
import SpyInstance = jest.SpyInstance;
import {BehaviorSubject} from "rxjs";

describe('RxState basic', () => {
  const option = { max: 5, min: 3, key: 'test' };
  const initState = {};
  let rxState!: any;
  beforeEach(() => {
    rxState = new RxState(option, initState) as any;
  });

  it('rxState basic props & methods', () => {
    expect(rxState.min).toEqual(option.min);
    expect(rxState.max).toEqual(option.max);
    expect(rxState.key).toEqual(option.key);
    expect(rxState.alive).toEqual(true);
    expect(rxState.initState).toBe(initState);
    expect(rxState.initCache.cacheKey).toEqual(INIT_CACHE_KEY);
    expect(rxState.initCache.data).toBe(initState);
    expect(rxState.cacheQueue.length).toEqual(0);
    expect(rxState.currentCache).toEqual(rxState.initCache);
  });

  it('rxState connect', () => {
    const cacheKey = { id: 1 };
    const listenToCache = jest.spyOn(rxState, 'listenToCache');
    rxState.connect({ cacheKey, dataEasing: false });
    expect(rxState.currentCache.cacheKey).toEqual(cacheKey);
    expect(rxState.dataEasing).toEqual(false);
    expect(rxState.cacheQueue.length).toEqual(1);
    expect(listenToCache).toHaveBeenCalledTimes(1);
    expect(listenToCache).toHaveBeenCalledWith(rxState.cacheQueue[0]);
    rxState.cacheQueue[0].unNotify();
  });

  it('rxState create cache: cacheKey comparison with 1-depth shallow equal', () => {
    rxState.connect({ cacheKey: INIT_CACHE_KEY, dataEasing: false });
    const cache1 = rxState.createAndSwitch([]);
    const cache2 = rxState.createAndSwitch([]);
    const cache3 = rxState.createAndSwitch({ a: [] });
    const cache4 = rxState.createAndSwitch({ a: [] });
    expect(cache1).toBe(cache2);
    expect(cache3).not.toBe(cache4);
    expect(rxState.cacheQueue.length).toEqual(3);
  });

});

describe('RxState freeze & destroy', ()=>{
  const option = { max: 5, min: 3, key: 'test' };
  const initState = {};
  let rxState!: any;
  let cache: RxCache;
  let initCache: RxCache;
  let cacheDestroy: SpyInstance;
  let initCacheDestroy: SpyInstance;
  let state$: BehaviorSubject<any>;
  beforeEach(() => {
    rxState = new RxState(option, initState) as any;
    rxState.connect({ cacheKey: INIT_CACHE_KEY, dataEasing: false });
    cache = rxState.createAndSwitch([]);
    initCache = rxState.initCache;
    cacheDestroy = jest.spyOn(cache, 'destroy')
    initCacheDestroy = jest.spyOn(initCache, 'destroy')
    state$ = rxState.state$;
  });
  it('rxState freeze', () => {
    rxState.freeze();
    expect(rxState.alive).toBe(true);
    expect(rxState.state$).toBeFalsy();
    expect(rxState.cacheQueue.length).toBe(1);
    expect(state$.closed).toBe(true);
    expect(cacheDestroy).toHaveBeenCalledTimes(0);
    expect(initCacheDestroy).toHaveBeenCalledTimes(0);
  });

  it('rxState destroy', () => {
    rxState.destroy();
    expect(rxState.alive).toBe(false);
    expect(rxState.state$).toBeFalsy();
    expect(rxState.cacheQueue.length).toBe(0);
    expect(state$.closed).toBe(true);
    // cache destroy
    expect(cacheDestroy).toHaveBeenCalledTimes(1);
    expect(initCacheDestroy).toHaveBeenCalledTimes(1);
  });
})
