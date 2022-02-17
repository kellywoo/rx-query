import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { RxQueryMutateFn, RxQueryOption, RxQueryStatus } from './rx-query.model';
import { RxQueryNotifier, RxStoreOptionSchemed } from './rx-query.schemed.model';
import { deepEqual, shallowEqualDepth } from './rx-query.util';
import { getRxConstSettings, RxConst } from './rx-const';

export abstract class RxStoreAbstract<A, B> {
  protected abstract readonly key: string;
  protected abstract readonly initState: A;
  protected abstract readonly retry: number;
  protected abstract readonly retryDelay: number;
  protected abstract isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
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
  public abstract readonly refetch: () => void;
  public abstract readonly mutate: (payload: RxQueryMutateFn<A>) => boolean;
  public abstract readonly destroy: () => void;
  public abstract readonly disableRefetch: (disable: boolean) => void;
}

export class RxStore<A, B = A> extends RxStoreAbstract<A, B> {
  protected readonly trigger$: Subject<{ param?: B }> = new Subject();
  protected readonly state$: BehaviorSubject<RxQueryStatus<A>>;
  protected readonly key: string;
  protected readonly initState: A;
  protected readonly retry: number;
  protected readonly retryDelay: number;
  protected readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected readonly query: RxStoreOptionSchemed<A, B>['query'];
  private RX_CONST: RxConst;

  constructor(options: RxQueryOption<A, B>, private notifiers?: RxQueryNotifier) {
    super();
    this.RX_CONST = getRxConstSettings();
    const { initState, key, query, isEqual, retry, retryDelay } = this.getDefaultOption(options);
    this.key = key;
    this.initState = initState;
    this.isEqual = isEqual;
    this.query = query;
    this.retry = retry;
    this.retryDelay = retryDelay;
    const state: RxQueryStatus<A> = {
      data: this.initState,
      ts: Date.now(),
      error: null,
      loading: false,
      untrustedData: true,
    };
    this.state$ = new BehaviorSubject(state);
    this.trigger$
      .pipe(
        switchMap(({ param }: any) => {
          let retryTimes = this.retry;
          this.state$.next({ ...this.state$.getValue(), loading: false, untrustedData: true });
          return this.query(param).pipe(
            tap((res) => {
              const state = this.state$.getValue();
              this.state$.next({
                ...this.state$.getValue(),
                data: deepEqual(res, state.data) ? state.data : res,
                loading: false,
                ts: Date.now(),
                error: null,
                untrustedData: false,
              });
            }),
            catchError((err, caught) => {
              if (retryTimes > 0) {
                retryTimes--;
                return timer(this.retryDelay).pipe(switchMap(() => caught));
              } else {
                this.state$.next({
                  ...this.state$.getValue(),
                  error: err,
                  untrustedData: true,
                });
                return EMPTY;
              }
            }),
          );
        }),
      )
      .subscribe();
  }

  private getDefaultOption(options: RxQueryOption<A, B>): RxStoreOptionSchemed<A, B> {
    return {
      key: options.key,
      initState: options.initState,
      isEqual: options.isEqual || shallowEqualDepth,
      retry: options.retry || this.RX_CONST.defaultRetry,
      retryDelay: options.retryDelay || this.RX_CONST.defaultRetryDelay,
      query: options.query || ((a?: B) => of(a as unknown as A)),
    };
  }

  public readonly select = <T>(selector?: (s: A) => T) => {
    return this.state$.pipe(
      map((state) => {
        return selector ? selector(state.data) : (state.data as unknown as T);
      }),
      distinctUntilChanged((a, b) => this.isEqual(a, b, 1)),
    );
  };

  public readonly status: () => Observable<RxQueryStatus<A>> = () => {
    // whole
    return this.state$.pipe(distinctUntilChanged((a, b) => this.isEqual(a, b, 3)));
  };

  public readonly fetch = (payload?: any) => {
    this.trigger$.next({ param: payload });
  };

  public readonly reset = () => {
    this.state$.next({
      data: this.initState,
      ts: Date.now(),
      error: null,
      loading: false,
    });
  };

  public readonly mutate = (payload: RxQueryMutateFn<A>) => {
    const state = this.state$.getValue();
    if (state.loading || state.untrustedData) {
      return false;
    }
    // before update set should be called, initstate same as state means set hasn't been done yet.
    const mutated = (payload as RxQueryMutateFn<A>)(state.data);
    if (!shallowEqualDepth(mutated, state.data, 1)) {
      this.state$.next({
        ...state,
        data: mutated,
      });
    }
    return true;
  };

  public readonly destroy = () => {
    this.state$.complete();
    this.trigger$.complete();
    if (this.notifiers?.destroy$) {
      this.notifiers.destroy$.next(this.key);
    }
  };

  public readonly refetch = () => {
    return this.unSupportedError('refetch') as never;
  };

  public disableRefetch = (disable: boolean) => {
    return this.unSupportedError('disableRefetch') as never;
  };
}
