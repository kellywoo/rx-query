import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
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
import { INIT_CACHE_KEY, RxState } from './rx-state';
import { RxCache } from './rx-cache';

export abstract class RxStoreAbstract<A, B> {
  protected abstract readonly key: string;
  protected abstract readonly initState: A;
  protected abstract readonly retry: number;
  protected abstract readonly retryDelay: number;
  protected abstract readonly RX_CONST: RxConst;
  protected abstract readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected abstract readonly cacheState: RxState;
  protected abstract readonly response$: Subject<RxQueryResponse<A>>;

  protected abstract fetched: boolean;

  protected unSupportedError = (name: string) => {
    throw new TypeError(`not supporting method for rxstore: ${name}`);
  };

  public readonly select = <T>(selector?: (s: A) => T) => {
    return this.cacheState.getState().pipe(
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
    return this.cacheState.getState().pipe(distinctUntilChanged((a, b) => this.isEqual(a, b, 2)));
  };

  public readonly getInitData = () => {
    return this.initState;
  };

  public getCurrentCache() {
    return this.cacheState.getCurrentCache();
  }

  public readonly mutate = (payload: RxQueryMutateFn<A>) => {
    return this.getCurrentCache().onMutate(payload);
  };

  public readonly getAliveCacheState = () => {
    return this.cacheState?.alive ? this.cacheState : null;
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

export class RxStore<A, B = A> extends RxStoreAbstract<A, B> {
  protected readonly key: string;
  protected readonly initState: A;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly query: RxStoreOptionSchemed<A, B>['query'];
  protected readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected readonly RX_CONST: RxConst;
  protected readonly response$: RxStoreAbstract<A, B>['response$'] = new Subject();
  protected readonly cacheState: RxState<A>;
  protected fetched = false;

  private readonly trigger$: Subject<{ param: B; cache: RxCache<A> }> = new Subject();
  private readonly keepAlive: boolean;
  private readonly destroy$ = new Subject<void>();

  constructor(
    options: RxQueryOption<A, B>,
    private notifiers: RxQueryNotifier,
    cacheState?: RxState<A>,
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
    this.cacheState =
      cacheState instanceof RxState && cacheState?.alive
        ? cacheState
        : new RxState<A>({ max: 0, min: 0, key: this.key }, this.initState);
    this.cacheState.connect({
      cacheKey: this.getCacheKey(),
      dataEasing: false,
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
        switchMap(({ param, cache }: { param: B; cache: RxCache<A> }) => {
          let retryTimes = this.retry;
          return this.query(param).pipe(
            tap((res) => {
              cache.onSuccess(res);
              this.response$.next({ type: 'success', refetch: false, data: res, param });
            }),
            catchError((err, caught) => {
              if (retryTimes > 0) {
                retryTimes--;
                return timer(this.retryDelay).pipe(switchMap(() => caught));
              } else {
                cache.onError(err);
                this.response$.next({ type: 'error', refetch: false, data: err, param });
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

  private getDefaultOption(options: RxQueryOption<A, B>): RxStoreOptionSchemed<A, B> {
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

  public readonly fetch = (payload?: B) => {
    this.fetched = true;
    const currentCache = this.cacheState.getCache(INIT_CACHE_KEY)!;
    currentCache.prepareFetching(payload);
    this.trigger$.next({ param: payload!, cache: currentCache });
  };

  public readonly reset = () => {
    this.fetched = false;
    this.cacheState.reset();
  };

  public readonly disableRefetch = () => {
    return this.unSupportedError('disableRefetch') as never;
  };

  public readonly destroy = () => {
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
