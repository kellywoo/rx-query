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
import { INIT_CACHE_KEY, RxState } from './rx-state';
import { RxCache } from './rx-cache';
import { defaultQuery, getRxConstSettings, RxConst } from './rx-const';

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
    dataEasing: options.dataEasing || false,
    paramToCachingKey:
      typeof options.paramToCachingKey === 'string'
        ? (() => {
            const key = options.paramToCachingKey;
            return (param: any) => param[key];
          })()
        : options.paramToCachingKey,
    refetchOnEmerge: options.refetchOnEmerge !== false,
    refetchOnReconnect: options.refetchOnReconnect !== false,
    refetchOnBackground: options.refetchOnBackground || false,
    minValidFocusTime: options.minValidFocusTime ?? minValidFocusTime,
    minValidReconnectTime: options.minValidReconnectTime ?? minValidReconnectTime,
    staleTime: options.staleTime ?? staleTime,
    refetchInterval: options.refetchInterval ?? staleTime,
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
  protected readonly cacheState: RxState;
  protected fetched = false;

  private readonly trigger$: Subject<{ refetch: boolean; cache: RxCache; param: unknown }> =
    new Subject();
  private readonly keepAlive: boolean;
  private readonly destroy$ = new Subject<undefined>();

  private readonly refetchInterval$ = new Subject<number>();
  private readonly refetchInterval: number;
  private readonly refetchOnReconnect: boolean;
  private readonly refetchOnEmerge: boolean;
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
    cacheState?: RxState<A>,
  ) {
    super();
    this.RX_CONST = getRxConstSettings();
    const {
      prefetch,
      initState,
      key,
      retry,
      retryDelay,
      refetchOnReconnect,
      refetchOnEmerge,
      refetchInterval,
      staleTime,
      refetchOnBackground,
      caching,
      keepAlive,
      dataEasing,
      minValidFocusTime,
      minValidReconnectTime,
      paramToCachingKey,
      query,
      isEqual,
    } = getDefaultRxQueryOption<A>(options, this.RX_CONST);
    this.key = key;
    this.query = query;
    this.initState = Object.freeze(initState) as A;
    this.refetchInterval = refetchInterval * 1000;
    this.retryDelay = retryDelay * 1000;
    this.staleTime = staleTime * 1000;
    this.retry = retry;
    this.refetchOnBackground = refetchOnBackground;
    this.refetchOnReconnect = refetchOnReconnect;
    this.refetchOnEmerge = refetchOnEmerge;
    this.keepAlive = keepAlive;
    this.minValidFocusTime = minValidFocusTime;
    this.minValidReconnectTime = minValidReconnectTime;
    this.isEqual = isEqual;
    this.paramToCachingKey = paramToCachingKey;
    this.subscribeStaleMode();
    this.cacheState =
      cacheState instanceof RxState && cacheState?.alive
        ? cacheState
        : new RxState<A>(
            { max: caching, min: this.RX_CONST.defaultCaching, key: this.key },
            this.initState,
          );
    const cacheStateOption = {
      cacheKey: prefetch ? this.getCacheKey(prefetch.param) : INIT_CACHE_KEY,
      dataEasing,
    };
    this.cacheState.connect(cacheStateOption);
    this.initQueryStream();
    if (prefetch) {
      this.fetch(prefetch.param);
    } else if (this.cacheState === cacheState) {
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
                this.refetchInterval$.next(this.refetchInterval);
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
                  this.refetchInterval$.next(this.refetchInterval);
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
    if (this.cacheState.max === 0) {
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
    if (this.refetchOnReconnect) {
      this.refetchSubscription.add(
        this.subscribeRezoom(this.notifiers.online$, this.minValidReconnectTime),
      );
    }
    if (this.refetchOnEmerge) {
      this.refetchSubscription.add(
        this.subscribeRezoom(this.notifiers.windowActive$, this.minValidFocusTime),
      );
    }
    if (this.refetchInterval > 0) {
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
    const cache = this.cacheState.createAndSwitch(cacheKey);
    cache.prepareFetching(param);
    this.trigger$.next({ cache, param: param!, refetch: false });
  };

  private readonly refetch = () => {
    if (this.refetchDisabled || (this.isOnBackground && !this.refetchOnBackground)) {
      this.refetchInterval$.next(this.refetchInterval);
      return;
    }
    const cache = this.getCurrentCache();
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
    this.cacheState.reset();
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
      this.cacheState.freeze();
    } else {
      this.cacheState.destroy();
    }
    if (this.notifiers.destroy$) {
      this.notifiers.destroy$.next(this.key);
    }
  };

  public override readonly mutate = (payload: RxQueryMutateFn<A>) => {
    return this.getCurrentCache().onMutate(payload);
  };
}
