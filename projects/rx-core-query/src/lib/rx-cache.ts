import { BehaviorSubject, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { RxQueryMutateFn, RxQueryStatus } from './rx-query.model';
import { deepEqual, shallowEqualDepth } from './rx-query.util';

export class RxCache<A = any> {
  private ts = 0;
  private error: Error | null = null;
  private loading = false;
  private data: A;
  private untrustedData = true;
  private status$;
  private stop$ = new Subject<undefined>();
  private origin?: { ts: number; data: A };
  private param: unknown;

  constructor(public cacheKey: any, private initData: A) {
    this.data = initData;
    this.status$ = new BehaviorSubject<RxQueryStatus<A>>(this.getCurrentData());
  }

  get notification$() {
    return this.status$.pipe(
      distinctUntilChanged((a, b) => shallowEqualDepth(a, b, 2)),
      takeUntil(this.stop$),
    );
  }

  public getLatestParam(): { param: unknown } | null {
    return this.ts === 0 ? null : { param: this.param };
  }

  public checkStaleTime(staleTime: number) {
    if (this.ts + staleTime < Date.now()) {
      this.untrustedData = true;
    }
  }

  public reset(data: A) {
    this.data = data;
    this.ts = 0;
    this.error = null;
    this.loading = false;
    this.untrustedData = true;
  }

  public isSameKey(cacheKey: any) {
    return shallowEqualDepth(this.cacheKey, cacheKey, 1);
  }

  public prepareFetching(param: unknown) {
    this.param = param;
    this.loading = true;
    this.error = null;
    this.notifyChange();
  }

  public onSuccess(data: A) {
    const isSame = deepEqual(this.data, data);
    this.loading = false;
    this.ts = Date.now();
    this.error = null;
    this.data = isSame ? this.data : data;
    this.untrustedData = false;
    this.notifyChange();
    this.origin = { ts: this.ts, data };
  }

  public onError(err: Error) {
    this.loading = false;
    this.error = err;
    this.untrustedData = true;
    this.notifyChange();
  }

  public onMutate(payload: RxQueryMutateFn<A>) {
    if (this.loading) {
      return false;
    }
    const mutated = (payload as RxQueryMutateFn<A>)(this.data);
    if (!shallowEqualDepth(mutated, this.data, 1)) {
      this.data = mutated;
      this.untrustedData = true;
      this.notifyChange();
    }
    return true;
  }

  public isLoading() {
    return this.loading;
  }

  public getCurrentData(): RxQueryStatus<A> {
    return {
      ts: this.ts,
      error: this.error,
      data: this.data,
      untrustedData: this.untrustedData,
      loading: this.loading,
    };
  }

  private notifyChange() {
    this.status$.next(this.getCurrentData());
  }

  public unNotify() {
    this.stop$.next(undefined);
    this.loading = false;
  }

  public destroy() {
    (this.data as unknown) = null;
    this.stop$.next(undefined);
    this.stop$.complete();
    this.stop$.unsubscribe();
    this.status$.complete();
    this.status$.unsubscribe();
  }
}
