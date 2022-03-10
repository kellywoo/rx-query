import { RxCache } from './rx-cache';
import { BehaviorSubject, filter } from 'rxjs';
import { RxQueryStatus } from './rx-query.model';
import { shallowEqualDepth } from './rx-query.util';

export const INIT_CACHE_KEY = Symbol();

export class RxCacheGroup<A = any> {
  private initCache: RxCache<A>;
  private currentCache!: RxCache<A>;
  private cacheQueue: RxCache<A>[] = [];
  private state$?: BehaviorSubject<RxQueryStatus<A>>;
  private cacheEasing = false;
  private key: string;
  private staleTime = 0;
  public max = 0;
  public destroyed = false;

  constructor(key: string, private initState: Readonly<A>) {
    this.initCache = new RxCache<A>(INIT_CACHE_KEY, this.initState);
    this.currentCache = this.initCache;
    this.key = key;
  }

  public connect({
    cacheKey,
    cacheEasing,
    staleTime,
    max,
  }: {
    cacheKey: any;
    cacheEasing: boolean;
    staleTime?: number;
    max: number;
  }) {
    // cacheKey can be undefined.
    const currentCache =
      cacheKey === INIT_CACHE_KEY
        ? this.initCache
        : this.find(cacheKey) || this.createCache(cacheKey);

    this.max = Math.max(max, 0);
    this.staleTime = staleTime || 0;
    this.cacheEasing = cacheEasing;
    this.state$ = new BehaviorSubject<RxQueryStatus<A>>(currentCache.getCurrentData());
    this.currentCache = currentCache;
    if (staleTime !== undefined) {
      this.currentCache.checkStaleTime(this.staleTime);
    }
    this.listenToCache(this.currentCache);
  }

  public getState() {
    this.checkValidation();
    return this.state$!.asObservable();
  }

  public reset() {
    this.checkValidation();
    this.initCache.reset(this.initState);
    this.swapWithCurrent(this.initCache);
    this.cacheQueue = [];
  }

  public getCurrentCache() {
    this.checkValidation();
    return this.currentCache;
  }

  public createAndSwitch(cacheKey: any) {
    this.checkValidation();
    const cache = this.find(cacheKey) || this.createCache(cacheKey);
    this.swapWithCurrent(cache);
    return cache;
  }

  public getCache(cacheKey: any): RxCache<A> | null {
    this.checkValidation();
    return this.find(cacheKey);
  }

  private checkValidation() {
    if (!this.state$) {
      throw new Error('connect it before use any methods');
    }
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
          return Boolean(state.error || !this.cacheEasing || state.ts !== 0);
        }),
      )
      .subscribe((state) => {
        if (!this.state$) {
          return;
        }
        const prev = this.state$.getValue();
        if (!shallowEqualDepth(prev, state, 1)) {
          this.state$.next(state);
        }
      });
  }

  private createCache(cacheKey: any): RxCache<A> {
    const cache = new RxCache<A>(cacheKey, this.initState);
    this.setCache(cacheKey, cache);
    return cache;
  }

  private find(cacheKey: any) {
    if (cacheKey === INIT_CACHE_KEY) {
      return this.initCache;
    }
    return this.cacheQueue.find((c) => c.isSameKey(cacheKey)) || null;
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

  public freeze() {
    this.state$?.complete();
    this.state$?.unsubscribe();
    this.state$ = undefined;
    this.currentCache.unNotify();
  }

  public destroy() {
    this.state$?.complete();
    this.state$?.unsubscribe();
    this.state$ = undefined;
    this.initCache.destroy();
    this.cacheQueue.forEach((value) => {
      value.destroy();
    });
    this.destroyed = true;
    this.cacheQueue = [];
  }
}
