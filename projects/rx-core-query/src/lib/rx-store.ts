import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  from,
  map,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { RxQueryMutateFn, RxQueryOption, RxQueryResponse, RxQueryStatus } from './rx-query.model';
import { RxQueryNotifier, RxStoreOptionSchemed } from './rx-query.schemed.model';
import { shallowEqualDepth } from './rx-query.util';
import { defaultQuery, getRxConstSettings, RxConst } from './rx-const';
import { INIT_CACHE_KEY, RxCacheGroup } from './rx-cache.group';
import { RxCache } from './rx-cache';
import { RxCacheManager } from './rx-cache.manager';

export abstract class RxStoreAbstract<A = unknown> {
  protected abstract readonly key: string;
  protected abstract readonly initState: A;
  protected abstract readonly retry: number;
  protected abstract readonly retryDelay: number;
  protected abstract readonly RX_CONST: RxConst;
  protected abstract readonly isEqual: RxStoreOptionSchemed<A>['isEqual'];
  protected abstract readonly cacheGroup: RxCacheGroup;
  protected abstract readonly response$: Subject<RxQueryResponse<A>>;

  protected abstract fetched: boolean;

  protected unSupportedError = (name: string) => {
    throw new TypeError(`not supporting method for rxstore: ${name}`);
  };

  public readonly select = <T>(selector?: (s: A) => T) => {
    return this.cacheGroup.getState().pipe(
      map((state) => {
        return selector ? selector(state.data) : (state.data as unknown as T);
      }),
      distinctUntilChanged((a, b) => this.isEqual(a, b, 1)),
    );
  };

  public readonly response = () => {
    return this.response$.asObservable();
  };

  public readonly status: () => Observable<RxQueryStatus<A>> = () => {
    // whole
    return this.cacheGroup.getState().pipe(distinctUntilChanged((a, b) => this.isEqual(a, b, 2)));
  };

  public readonly getInitData = () => {
    return this.initState;
  };

  public getCurrentCache() {
    return this.cacheGroup.getCurrentCache();
  }

  public readonly mutate = (payload: RxQueryMutateFn<A>) => {
    return this.getCurrentCache().onMutate(payload);
  };

  public readonly reload = () => {
    if (!this.fetched) {
      return;
    }
    const param = this.getCurrentCache().getLatestParam();
    if (param) {
      this.fetch(param.param);
    } else {
      console.error('you should fetch before reload');
    }
  };

  public readonly getCurrentState = () => {
    return this.getCurrentCache().getCurrentData();
  };

  public abstract readonly fetch: (payload?: any) => void;
  public abstract readonly reset: () => void;
  public abstract readonly destroy: () => void;
  public abstract readonly disableRefetch: (disable: boolean) => void;
}

export class RxStore<A = unknown> extends RxStoreAbstract<A> {
  protected readonly key: string;
  protected readonly initState: A;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly query: RxStoreOptionSchemed<A>['query'];
  protected readonly isEqual: RxStoreOptionSchemed<A>['isEqual'];
  protected readonly RX_CONST: RxConst;
  protected readonly response$: RxStoreAbstract<A>['response$'] = new Subject();
  protected readonly cacheGroup: RxCacheGroup<A>;
  protected fetched = false;

  private readonly trigger$: Subject<{ param: unknown; cache: RxCache<A> }> = new Subject();
  private readonly keepAlive: boolean;
  private readonly destroy$ = new Subject<undefined>();

  constructor(
    options: RxQueryOption<A>,
    private notifiers: RxQueryNotifier,
    private cacheManager: RxCacheManager,
  ) {
    super();
    this.RX_CONST = getRxConstSettings();
    const { initState, key, query, isEqual, retry, retryDelay, prefetch, keepAlive } =
      this.getDefaultOption(options);
    this.key = key;
    this.initState = initState;
    this.isEqual = isEqual;
    this.query = query;
    this.retry = retry;
    this.keepAlive = keepAlive;
    this.retryDelay = retryDelay;
    const cacheGroup = cacheManager.getCache(this.key);
    this.cacheGroup = cacheGroup || new RxCacheGroup<A>(this.key, this.initState);
    if (cacheGroup !== this.cacheGroup) {
      this.cacheManager.setCache(this.key, this.cacheGroup);
    }
    this.cacheGroup.connect({
      cacheKey: this.getCacheKey(),
      cacheEasing: false,
      max: 0,
    });
    this.initQueryStream();
    if (prefetch) {
      this.fetch(prefetch.param);
    }
  }

  private initQueryStream() {
    this.trigger$
      .pipe(
        debounceTime(0), // prevent multi request for one
        switchMap(({ param, cache }: { param: unknown; cache: RxCache<A> }) => {
          let retryTimes = this.retry;
          const querySource = this.query(param);
          const query$ = querySource instanceof Observable ? querySource : from(querySource);
          return query$.pipe(
            tap((res) => {
              cache.onSuccess(res);
              this.response$.next({
                type: 'success' as RxQueryResponse<A>['type'],
                refetch: false,
                data: res,
                param,
              });
            }),
            catchError((err, caught) => {
              if (retryTimes > 0) {
                retryTimes--;
                return timer(this.retryDelay).pipe(switchMap(() => caught));
              } else {
                cache.onError(err);
                this.response$.next({
                  type: 'error' as RxQueryResponse<A>['type'],
                  refetch: false,
                  data: err,
                  param,
                });
                return EMPTY;
              }
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private getCacheKey() {
    return INIT_CACHE_KEY;
  }

  private getDefaultOption(options: RxQueryOption<A>): RxStoreOptionSchemed<A> {
    return {
      key: options.key,
      initState: options.initState,
      prefetch: options.prefetch || null,
      keepAlive: options.keepAlive || false,
      isEqual: options.isEqual || shallowEqualDepth,
      retry: options.retry ?? this.RX_CONST.defaultRetry,
      retryDelay: options.retryDelay ?? this.RX_CONST.defaultRetryDelay,
      query: options.query || defaultQuery,
    };
  }

  public readonly fetch = (payload?: unknown) => {
    this.fetched = true;
    const currentCache = this.cacheGroup.getCache(INIT_CACHE_KEY)!;
    currentCache.prepareFetching(payload);
    this.trigger$.next({ param: payload!, cache: currentCache });
  };

  public readonly reset = () => {
    this.fetched = false;
    this.cacheGroup.reset();
  };

  public readonly disableRefetch = () => {
    return this.unSupportedError('disableRefetch') as never;
  };

  public readonly destroy = () => {
    this.destroy$.next(undefined);
    this.destroy$.complete();
    this.trigger$.complete();
    this.response$.complete();
    if (this.keepAlive) {
      this.cacheManager.freezeCache(this.key);
    } else {
      this.cacheManager.removeCache(this.key);
    }
    if (this.notifiers.destroy$) {
      this.notifiers.destroy$.next(this.key);
    }
  };
}
