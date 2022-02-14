import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  EMPTY,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { RxQueryMutateFn, RxQueryOption, RxQueryStatus } from './rx-query.model';
import { RxQueryNotifier, RxStoreOptionSchemed } from './rx-query.schemed.model';
import { shallowEqualDepth } from './rx-query.util';

export abstract class RxStoreAbstract<A, B> {
  protected abstract readonly key: string;
  protected abstract readonly initState: A;
  protected abstract isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected unSupportedError = (name: string) => {
    return new Error(`not supporting method for rxstore: ${name}`);
  }

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
  protected readonly isEqual: RxStoreOptionSchemed<A, B>['isEqual'];
  protected readonly query: RxStoreOptionSchemed<A, B>['query'];

  constructor(options: RxQueryOption<A, B>, private notifiers?: RxQueryNotifier) {
    super();
    const { initState, key, query, isEqual } = this.getDefaultOption(options);
    this.key = key;
    this.initState = initState;
    this.isEqual = isEqual;
    this.query = query;
    const state: RxQueryStatus<A> = {
      data: this.initState,
      ts: Date.now(),
      error: null,
      loading: false,
    };
    this.state$ = new BehaviorSubject(state);
    this.trigger$
      .pipe(
        switchMap(({ param }: any) => {
          return this.query(param).pipe(
            tap((res) => {
              this.state$.next({
                ...this.state$.getValue(),
                data: res,
                loading: false,
                ts: Date.now(),
                error: null,
              });
            }),
            catchError((err) => {
              this.state$.next({
                ...this.state$.getValue(),
                error: err,
                ts: Date.now(),
              });
              return merge(EMPTY, this.trigger$);
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

  public readonly refetch = () => {
    return this.unSupportedError('refetch') as never;
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
    // before update set should be called, initstate same as state means set hasn't been done yet.
    const mutated = (payload as RxQueryMutateFn<A>)(state.data);
    if (state.data !== mutated) {
      this.state$.next({
        ...(state || null),
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

  public disableRefetch = (disable: boolean) => {
    return this.unSupportedError('disableRefetch') as never;
  };
}
