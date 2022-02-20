import { RxCache } from './rx-cache';
import { BehaviorSubject } from 'rxjs';
import { RxQueryStatus } from './rx-query.model';

export const INIT_CACHE_KEY = Symbol();

export class RxState<A = any, B = any> {
  private initCache: RxCache<A, B>;
  private currentCache!: RxCache<A, B>;
  private cacheQueue: RxCache<A, B>[] = [];
  private state$!: BehaviorSubject<RxQueryStatus<A>>;
  public alive = true;
  public readonly max: number;
  public readonly min: number;
  constructor({ max, min }: { max: number; min: number }, private initState: A) {
    this.initCache = new RxCache<A, B>(INIT_CACHE_KEY, this.initState);
    this.min = Math.floor(Math.max(min || 0, 0));
    this.max = Math.floor(Math.max(max, this.min));
  }

  public connect(cacheKey?: any) {
    const currentCache = this.getCache(cacheKey) || this.initCache;
    this.state$ = new BehaviorSubject<RxQueryStatus<A>>(currentCache.getCurrentData());
    this.currentCache = currentCache;
    this.listenToCache(this.currentCache);
  }

  private swapWithCurrent(cache: RxCache<A, B>) {
    if (cache !== this.currentCache) {
      this.currentCache.unNotify();
      this.currentCache = cache;
      this.listenToCache(this.currentCache);
    }
  }

  private listenToCache(cache: RxCache<A, B>) {
    cache.notification$.subscribe((state) => {
      this.state$.next(state);
    });
  }

  public getState() {
    return this.state$.asObservable();
  }

  public reset() {
    this.initCache.reset(this.initState);
    this.swapWithCurrent(this.initCache);
    this.cacheQueue = [];
  }

  public getCurrentCache() {
    return this.currentCache;
  }

  public createAndSwitch(cacheKey: any) {
    let cache = this.find(cacheKey);
    if (!cache) {
      cache = new RxCache<A, B>(cacheKey, this.initState);
      this.setCache(cacheKey, cache);
    }
    this.swapWithCurrent(cache);
    return cache;
  }

  public getCache(cacheKey: any): RxCache<A, B> | null {
    if (cacheKey === INIT_CACHE_KEY) {
      return this.initCache;
    }
    return this.find(cacheKey) || null;
  }

  private find(cacheKey: any) {
    return this.cacheQueue.find((c) => c.isSameKey(cacheKey));
  }

  private setCache(cacheKey: any, cache: RxCache<A, B>) {
    const idx = this.cacheQueue.findIndex((c) => c.isSameKey(cacheKey));
    const exists = idx >= 0;
    if (this.max === this.cacheQueue.length && !exists) {
      this.cacheQueue.shift();
    } else if (exists) {
      this.cacheQueue.splice(idx, 1);
    }
    this.cacheQueue.push(cache);
  }

  freeze() {
    this.state$.complete();
    this.currentCache.unNotify();
  }

  destroy() {
    this.state$.complete();
    this.currentCache.unNotify();
    this.alive = false;
    this.cacheQueue.forEach((value) => {
      value.destroy();
    });
    this.cacheQueue = [];
  }
}
