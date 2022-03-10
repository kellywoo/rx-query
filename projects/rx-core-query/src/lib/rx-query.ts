import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  scan,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { RxQueryMutateFn, RxQueryOption, RxQueryResponse } from './rx-query.model';
import {
  RxQueryNotifier,
  RxQueryOptionSchemed,
  RxStoreOptionSchemed,
} from './rx-query.schemed.model';
import { RxStoreAbstract } from './rx-store';
import { shallowEqualDepth } from './rx-query.util';
import { INIT_CACHE_KEY, RxCacheGroup } from './rx-cache.group';
import { RxCache } from './rx-cache';
import { defaultQuery, getRxConstSettings, RxConst } from './rx-const';
import { RxCacheManager } from './rx-cache.manager';

export const getDefaultRxQueryOption = <A = unknown>(
  options: RxQueryOption<A>,
  rxConst: RxConst,
): RxQueryOptionSchemed<A> => {
  const {
    staleTime,
    defaultRetryDelay,
    defaultRetry,
    defaultCaching,
    maxCaching,
    minValidFocusTime,
    minValidReconnectTime,
  } = rxConst;

  return {
    key: options.key,
    query: options.query || defaultQuery,
    initState: options.initState,
    prefetch: options.prefetch || null,
    isEqual: options.isEqual || shallowEqualDepth,
    keepAlive: options.keepAlive || false,
    retry: options.retry ?? defaultRetry,
    retryDelay: options.retryDelay ?? defaultRetryDelay,
    cacheEasing: options.cacheEasing || false,
    paramToCachingKey:
      typeof options.paramToCachingKey === 'string'
        ? (() => {
            const key = options.paramToCachingKey;
            return (param: any) => param[key];
          })()
        : options.paramToCachingKey,
    staleCheckOnFocus: options.staleCheckOnFocus !== false,
    staleCheckOnReconnect: options.staleCheckOnReconnect !== false,
    refetchOnBackground: options.refetchOnBackground || false,
    minValidFocusTime: options.minValidFocusTime ?? minValidFocusTime,
    minValidReconnectTime: options.minValidReconnectTime ?? minValidReconnectTime,
    staleTime: options.staleTime ?? staleTime,
    staleCheckOnInterval: options.staleCheckOnInterval ?? true,
    caching: Math.min(Math.max(options.caching || defaultCaching, 0), maxCaching),
  };
};

export class RxQuery<A = unknown> extends RxStoreAbstract<A> {
  protected readonly key: string;
  protected readonly initState: Readonly<A>;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly query: RxStoreOptionSchemed<A>['query'];
  protected readonly isEqual: RxStoreOptionSchemed<A>['isEqual'];
  protected readonly RX_CONST: RxConst;
  protected readonly response$: RxStoreAbstract<A>['response$'] = new Subject();
  protected readonly cacheGroup: RxCacheGroup;
  protected fetched = false;

  private readonly trigger$: Subject<{ refetch: boolean; cache: RxCache; param: unknown }> =
    new Subject();
  private readonly keepAlive: boolean;
  private readonly destroy$ = new Subject<undefined>();

  private readonly refetchInterval$ = new Subject<number>();
  private readonly staleCheckOnInterval: boolean;
  private readonly staleCheckOnReconnect: boolean;
  private readonly staleCheckOnFocus: boolean;
  private readonly staleTime: number;
  private readonly refetchOnBackground: boolean;
  private readonly paramToCachingKey?: (p: any) => any;
  private refetchDisabled = false;
  private isOnBackground = false;
  private refetchSubscription?: Subscription;
  private lastSuccessTime = 0;
  private minValidReconnectTime = 0;
  private minValidFocusTime = 0;

  constructor(
    options: RxQueryOption<A>,
    private notifiers: RxQueryNotifier,
    private cacheManager: RxCacheManager,
  ) {
    super();
    this.RX_CONST = getRxConstSettings();
    const {
      prefetch,
      initState,
      key,
      retry,
      retryDelay,
      staleCheckOnReconnect,
      staleCheckOnFocus,
      staleCheckOnInterval,
      staleTime,
      refetchOnBackground,
      caching,
      keepAlive,
      cacheEasing,
      minValidFocusTime,
      minValidReconnectTime,
      paramToCachingKey,
      query,
      isEqual,
    } = getDefaultRxQueryOption<A>(options, this.RX_CONST);
    this.key = key;
    this.query = query;
    this.initState = Object.freeze(initState) as A;
    this.staleCheckOnInterval = staleCheckOnInterval;
    this.retryDelay = retryDelay * 1000;
    this.staleTime = staleTime * 1000;
    this.retry = retry;
    this.refetchOnBackground = refetchOnBackground;
    this.staleCheckOnReconnect = staleCheckOnReconnect;
    this.staleCheckOnFocus = staleCheckOnFocus;
    this.keepAlive = keepAlive;
    this.minValidFocusTime = minValidFocusTime;
    this.minValidReconnectTime = minValidReconnectTime;
    this.isEqual = isEqual;
    this.paramToCachingKey = paramToCachingKey;
    this.subscribeStaleMode();
    const cacheGroup = cacheManager.getCache(this.key);
    this.cacheGroup = cacheGroup || new RxCacheGroup<A>(this.key, this.initState);
    const cacheStateOption = {
      cacheKey: prefetch ? this.getCacheKey(prefetch.param) : INIT_CACHE_KEY,
      cacheEasing,
      staleTime: this.staleTime,
      max: caching,
    };
    this.cacheGroup.connect(cacheStateOption);
    if (cacheGroup !== this.cacheGroup) {
      this.cacheManager.setCache(this.key, this.cacheGroup);
    }
    this.initQueryStream();
    if (prefetch) {
      this.fetch(prefetch.param);
    } else if (this.cacheGroup === cacheGroup) {
      this.refetch();
    }
  }

  private subscribeStaleMode() {
    combineLatest([
      merge(of(document.visibilityState === 'visible'), this.notifiers.windowActive$),
      merge(of(navigator.onLine), this.notifiers.online$),
    ])
      .pipe(
        map<[boolean, boolean], boolean>(([visibility, online]) => {
          return !visibility || !online;
        }),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((isOnBackground) => {
        this.isOnBackground = isOnBackground;
      });
  }

  private initQueryStream() {
    this.trigger$
      .pipe(
        debounceTime(0), // prevent multi request for one
        switchMap(
          ({ param, cache, refetch }: { param: unknown; cache: RxCache<A>; refetch: boolean }) => {
            let retryTimes = this.retry;
            const querySource = this.query(param);
            const query$ = querySource instanceof Observable ? querySource : from(querySource);
            return query$.pipe(
              tap((res: A) => {
                cache.onSuccess(res);
                this.lastSuccessTime = Date.now();
                this.refetchInterval$.next(this.staleTime);
                this.response$.next({
                  type: 'success' as RxQueryResponse<A>['type'],
                  refetch,
                  data: res,
                  param,
                });
              }),
              catchError((err, caught) => {
                if (retryTimes > 0 && !this.isOnBackground) {
                  retryTimes--;
                  return timer(this.retryDelay).pipe(switchMap(() => caught));
                } else {
                  if (!refetch) {
                    cache.onError(err);
                  }
                  this.refetchInterval$.next(this.staleTime);
                  this.response$.next({
                    type: 'error' as RxQueryResponse<A>['type'],
                    refetch,
                    data: err,
                    param,
                  });
                  return EMPTY;
                }
              }),
            );
          },
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private getCacheKey(param?: unknown) {
    if (this.cacheGroup.max === 0) {
      return INIT_CACHE_KEY;
    }
    if (this.paramToCachingKey) {
      return this.paramToCachingKey(param);
    }
    return param;
  }

  private subscribeRezoom(target$: Observable<boolean>, duration: number) {
    return target$
      .pipe(
        distinctUntilChanged(),
        scan<boolean, { startTime: number; isOn: boolean }, null>((p, isOn) => {
          if (!p) {
            return { startTime: Date.now(), isOn };
          }
          return {
            isOn,
            startTime: isOn ? p.startTime! : Date.now(),
          };
        }, null),
        filter(({ isOn, startTime }) => {
          return isOn && Date.now() - startTime > duration;
        }),
      )
      .subscribe(() => {
        this.refetch();
      });
  }

  private setRefetchStrategy(fetchInitiated: boolean) {
    if (this.fetched === fetchInitiated) {
      return;
    }
    this.fetched = fetchInitiated;
    if (!this.fetched) {
      this.refetchSubscription?.unsubscribe();
      return;
    }
    this.refetchSubscription = new Subscription();
    if (this.staleCheckOnReconnect) {
      this.refetchSubscription.add(
        this.subscribeRezoom(this.notifiers.online$, this.minValidReconnectTime),
      );
    }
    if (this.staleCheckOnFocus) {
      this.refetchSubscription.add(
        this.subscribeRezoom(this.notifiers.windowActive$, this.minValidFocusTime),
      );
    }
    if (this.staleCheckOnInterval) {
      this.refetchSubscription.add(
        this.refetchInterval$
          .pipe(
            switchMap((delayTime) => {
              return delayTime <= 0 ? EMPTY : timer(delayTime);
            }),
            takeUntil(this.destroy$),
          )
          .subscribe(() => {
            this.refetch();
          }),
      );
    }
  }

  public readonly fetch = (param?: unknown) => {
    this.setRefetchStrategy(true);
    const cacheKey = this.getCacheKey(param);
    const cache = this.cacheGroup.createAndSwitch(cacheKey);
    cache.prepareFetching(param);
    this.trigger$.next({ cache, param: param!, refetch: false });
  };

  private readonly refetch = () => {
    if (this.refetchDisabled || (this.isOnBackground && !this.refetchOnBackground)) {
      // in case of failed by flags, then should check more frequently
      this.refetchInterval$.next(Math.min(60 * 1000, this.staleTime));
      return;
    }
    const cache = this.getCurrentCache();
    cache.checkStaleTime(this.staleTime);
    const state = cache.getCurrentData();
    const param = cache.getLatestParam();
    if (state.loading || !param) {
      return;
    }
    const stillValid = Date.now() < state.ts + this.staleTime;
    if (stillValid && !state.untrustedData) {
      return;
    }
    this.trigger$.next({
      cache,
      param: param.param,
      refetch: true,
    });
  };

  public readonly reset = () => {
    this.setRefetchStrategy(false);
    this.cacheGroup.reset();
  };

  public readonly disableRefetch = (disabled: boolean) => {
    this.refetchDisabled = disabled;
  };

  public readonly destroy = () => {
    this.refetchInterval$.complete();
    this.setRefetchStrategy(false);
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

  public override readonly mutate = (payload: RxQueryMutateFn<A>) => {
    return this.getCurrentCache().onMutate(payload);
  };
}
