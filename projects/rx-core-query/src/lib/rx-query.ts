import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
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
import { RxQueryOption } from './rx-query.model';
import {
  RxQueryNotifier,
  RxQueryOptionSchemed,
  RxStoreOptionSchemed,
} from './rx-query.schemed.model';
import { RxStoreAbstract } from './rx-store';
import { shallowEqualDepth } from './rx-query.util';
import { INIT_CACHE_KEY, RxState } from './rx-state';
import { RxCache } from './rx-cache';
import { getRxConstSettings, RxConst } from './rx-const';

export class RxQuery<A, B = any> extends RxStoreAbstract<A, B> {
  protected readonly key: string;
  protected readonly initState: Readonly<A>;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly query: RxStoreOptionSchemed<A, B>['query'];
  protected readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected readonly RX_CONST: RxConst;
  protected readonly response$: RxStoreAbstract<A, B>['response$'] = new Subject();
  protected readonly cacheState: RxState;
  protected latestParam?: B;
  protected fetched = false;

  private readonly refetchInterval: number;
  private readonly refetchOnReconnect: boolean;
  private readonly refetchOnEmerge: boolean;
  private readonly staleTime: number;
  private readonly refetchOnBackground: boolean;
  private readonly keepAlive: boolean;
  private readonly paramToCachingKey?: (p: any) => any;

  private readonly trigger$: Subject<{ refetch: boolean; cache: RxCache; param: B }> =
    new Subject();
  private readonly refetchInterval$ = new Subject<number>();
  private readonly destroy$ = new Subject<void>();

  private refetchDisabled = false;
  private isOnBackground = false;
  private refetchSubscription?: Subscription;
  private lastSuccessTime = 0;

  constructor(
    options: RxQueryOption<A, B>,
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
      paramToCachingKey,
      query,
      isEqual,
    } = this.getDefaultOption(options);
    this.key = key;
    this.query = query;
    this.initState = Object.freeze(initState);
    this.refetchInterval = refetchInterval * 1000;
    this.retry = retry;
    this.retryDelay = retryDelay * 1000;
    this.staleTime = staleTime * 1000;
    this.refetchOnBackground = refetchOnBackground;
    this.refetchOnReconnect = refetchOnReconnect;
    this.refetchOnEmerge = refetchOnEmerge;
    this.keepAlive = keepAlive;
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
          ({ param, cache, refetch }: { param: B; cache: RxCache<A>; refetch: boolean }) => {
            let retryTimes = this.retry;
            return this.query(param).pipe(
              tap((res) => {
                cache.onSuccess(res);
                this.lastSuccessTime = Date.now();
                this.refetchInterval$.next(this.refetchInterval);
                this.response$.next({ type: 'success', refetch, data: res, param });
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
                  this.response$.next({ type: 'error', refetch, data: err, param });
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

  private getCacheKey(param?: any) {
    if (this.cacheState.max === 0) {
      return INIT_CACHE_KEY;
    }
    if (this.paramToCachingKey) {
      return this.paramToCachingKey(param);
    }
    return param;
  }

  private getDefaultOption(options: RxQueryOption<A, B>): RxQueryOptionSchemed<A, B> {
    const {
      staleTime,
      defaultRetryDelay,
      defaultRetry,
      defaultCaching,
      defaultInterval,
      minRefetchTime,
      maxCaching,
    } = this.RX_CONST;

    return {
      key: options.key,
      query: options.query || ((a?: B) => of(a as unknown as A)),
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
      staleTime: options.staleTime ?? staleTime,
      refetchInterval:
        options.refetchInterval === 0
          ? 0
          : Math.max(options.refetchInterval || defaultInterval, minRefetchTime), // does not take 0
      caching: Math.min(Math.max(options.caching || defaultCaching, 0), maxCaching),
    };
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
        if (this.lastSuccessTime + duration < Date.now()) {
          this.refetch();
        }
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
        this.subscribeRezoom(this.notifiers.online$, this.RX_CONST.minValidReconnectTime),
      );
    }
    if (this.refetchOnEmerge) {
      this.refetchSubscription.add(
        this.subscribeRezoom(this.notifiers.windowActive$, this.RX_CONST.minValidFocusTime),
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
            if (this.refetchDisabled || (this.isOnBackground && !this.refetchOnBackground)) {
              this.refetchInterval$.next(this.refetchInterval);
              return;
            }
            this.refetch();
          }),
      );
    }
  }

  public readonly fetch = (param?: B) => {
    this.setRefetchStrategy(true);
    const cacheKey = this.getCacheKey(param);
    const cache = this.cacheState.createAndSwitch(cacheKey);
    const state = cache.getCurrentData();
    this.latestParam = param;
    if (state.ts === 0 || Date.now() > state.ts + this.staleTime) {
      cache.prepareFetching();
      this.trigger$.next({ cache, param: param!, refetch: false });
    }
  };

  private readonly refetch = () => {
    if (!this.fetched || this.refetchDisabled) {
      return;
    }
    this.trigger$.next({
      cache: this.cacheState.getCurrentCache(),
      param: this.latestParam!,
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

    this.destroy$.next();
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
}
