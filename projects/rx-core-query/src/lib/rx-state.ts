import { RxCache } from './rx-cache';
import { BehaviorSubject, filter, skip, tap } from 'rxjs';
import { RxQueryStatus } from './rx-query.model';
import { shallowEqualDepth } from './rx-query.util';

export const INIT_CACHE_KEY = Symbol();

export class RxState<A = any, B = any> {
  private initCache: RxCache<A>;
  private currentCache!: RxCache<A>;
  private cacheQueue: RxCache<A>[] = [];
  private state$!: BehaviorSubject<RxQueryStatus<A>>;
  private dataEasing = false;
  private key: string;
  public alive = true;
  public readonly max: number;
  public readonly min: number;

  constructor({ max, min, key }: { max: number; min: number; key: string }, private initState: A) {
    this.initCache = new RxCache<A>(INIT_CACHE_KEY, this.initState);
    this.min = Math.floor(Math.max(min || 0, 0));
    this.max = Math.floor(Math.max(max, this.min));
    this.key = key;
  }

  public connect({ cacheKey, dataEasing }: { cacheKey: any; dataEasing: boolean }) {
    const currentCache = cacheKey === INIT_CACHE_KEY ? this.initCache : this.getCache(cacheKey) || this.createCache(cacheKey);
    this.dataEasing = dataEasing;
    this.state$ = new BehaviorSubject<RxQueryStatus<A>>(currentCache.getCurrentData());
    this.currentCache = currentCache;
    this.listenToCache(this.currentCache);
  }

  private swapWithCurrent(cache: RxCache<A>) {
    if (cache !== this.currentCache) {
      this.currentCache.unNotify();
      this.currentCache = cache;
      this.listenToCache(this.currentCache);
    }
  }

  private listenToCache(cache: RxCache<A>) {
    cache.notification$
      .pipe(
        filter((state) => {
          return Boolean(state.error || !this.dataEasing || state.ts !== 0);
        }),
      )
      .subscribe((state) => {
        const prev = this.state$.getValue();
        if (!shallowEqualDepth(prev, state, 1)) {
          this.state$.next(state);
        }
      });
  }

  private createCache(cacheKey: any): RxCache<A>{
    const cache = new RxCache<A>(cacheKey, this.initState);
    this.setCache(cacheKey, cache);
    return cache;
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
    let cache = this.find(cacheKey) || this.createCache(cacheKey);
    this.swapWithCurrent(cache);
    return cache;
  }

  public getCache(cacheKey: any): RxCache<A> | null {
    if (cacheKey === INIT_CACHE_KEY) {
      return this.initCache;
    }
    return this.find(cacheKey) || null;
  }

  private find(cacheKey: any) {
    return this.cacheQueue.find((c) => c.isSameKey(cacheKey));
  }

  private setCache(cacheKey: any, cache: RxCache<A>) {
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
