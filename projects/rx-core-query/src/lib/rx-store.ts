import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { RxQueryMutateFn, RxQueryOption, RxQueryStatus } from './rx-query.model';
import { RxQueryNotifier, RxStoreOptionSchemed } from './rx-query.schemed.model';
import { shallowEqualDepth } from './rx-query.util';
import { getRxConstSettings, RxConst } from './rx-const';
import { INIT_CACHE_KEY, RxState } from './rx-state';
import { RxCache } from './rx-cache';

export abstract class RxStoreAbstract<A, B> {
  protected abstract readonly key: string;
  protected abstract readonly initState: A;
  protected abstract readonly retry: number;
  protected abstract readonly retryDelay: number;
  protected abstract readonly RX_CONST: RxConst;
  protected abstract readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];

  protected abstract latestParam?: B;

  protected unSupportedError = (name: string) => {
    return new Error(`not supporting method for rxstore: ${name}`);
  };

  public readonly getInitData = () => {
    return this.initState;
  };
  public abstract readonly select: <T>(selector?: (s: A) => T) => Observable<T>;
  public abstract readonly status: () => Observable<RxQueryStatus<A>>;
  public abstract readonly fetch: (payload?: any) => void;
  public abstract readonly reset: () => void;
  public abstract readonly reload: () => void;
  public abstract readonly mutate: (payload: RxQueryMutateFn<A>) => boolean;
  public abstract readonly destroy: () => void;
  public abstract readonly disableRefetch: (disable: boolean) => void;
  public abstract readonly getKeepAlivedState: () => null | RxState;
}

export class RxStore<A, B = A> extends RxStoreAbstract<A, B> {
  protected readonly trigger$: Subject<{ param?: B; cache: RxCache<A> }> = new Subject();
  protected readonly key: string;
  protected readonly initState: A;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected readonly query: RxStoreOptionSchemed<A, B>['query'];
  protected readonly RX_CONST: RxConst;
  protected latestParam?: B;

  private readonly cacheState: RxState<A>;
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
      this.keepAlive && cacheState
        ? cacheState
        : new RxState<A>({ max: 0, min: 0, key: this.key }, this.initState);
    this.cacheState.connect({
      cacheKey: this.getCacheKey(),
      dataEasing: true,
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
        switchMap(({ param, cache }: { param?: B; cache: RxCache<A> }) => {
          let retryTimes = this.retry;
          return this.query(param).pipe(
            tap((res) => {
              cache.onSuccess(res);
            }),
            catchError((err, caught) => {
              if (retryTimes > 0) {
                retryTimes--;
                return timer(this.retryDelay).pipe(switchMap(() => caught));
              } else {
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
      query: options.query || ((a?: B) => of(a as unknown as A)),
    };
  }

  public readonly select = <T>(selector?: (s: A) => T) => {
    return this.cacheState.getState().pipe(
      map((state) => {
        return selector ? selector(state.data) : (state.data as unknown as T);
      }),
      distinctUntilChanged((a, b) => this.isEqual(a, b, 1)),
    );
  };

  public readonly status: () => Observable<RxQueryStatus<A>> = () => {
    // whole
    return this.cacheState.getState().pipe(distinctUntilChanged((a, b) => this.isEqual(a, b, 2)));
  };

  public readonly fetch = (payload?: B) => {
    this.latestParam = payload;
    this.trigger$.next({ param: payload, cache: this.cacheState.getCache(INIT_CACHE_KEY)! });
  };

  public readonly reload = () => {
    this.fetch(this.latestParam);
  };

  public readonly reset = () => {
    this.cacheState.reset();
  };

  public readonly disableRefetch = () => {
    return this.unSupportedError('disableRefetch') as never;
  };

  public readonly mutate = (payload: RxQueryMutateFn<A>) => {
    return this.cacheState.getCurrentCache().onMutate(payload);
  };

  public readonly destroy = () => {
    this.destroy$.next();
    this.destroy$.complete();
    this.trigger$.complete();
    if (this.keepAlive) {
      this.cacheState.freeze();
    } else {
      this.cacheState.destroy();
    }
    if (this.notifiers.destroy$) {
      this.notifiers.destroy$.next(this.key);
    }
  };

  public readonly getKeepAlivedState = () => {
    return this.cacheState?.alive ? this.cacheState : null;
  };
}
