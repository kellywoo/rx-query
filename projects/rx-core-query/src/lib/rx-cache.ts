import { BehaviorSubject, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { RxQueryMutateFn, RxQueryStatus } from './rx-query.model';
import { deepEqual, shallowEqualDepth } from './rx-query.util';

export class RxCache<A = any, B = any> {
  private ts = 0;
  private error: Error | null = null;
  private loading = false;
  private data: A;
  private untrustedData = true;
  private status$;
  private stop$ = new Subject<void>();

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

  reset(data: A) {
    this.data = data;
    this.ts = 0;
    this.error = null;
    this.loading = false;
    this.untrustedData = true;
  }

  isSameKey(cacheKey: any) {
    return shallowEqualDepth(this.cacheKey, cacheKey, 1);
  }

  prepareFetching() {
    this.loading = true;
    this.error = null;
    this.notifyChange();
  }

  onSuccess(data: A) {
    const isSame = deepEqual(this.data, data);
    this.loading = false;
    this.ts = Date.now();
    this.error = null;
    this.data = isSame ? this.data : data;
    this.untrustedData = false;
    this.notifyChange();
  }

  onError(err: Error, refetch?: boolean) {
    this.loading = false;
    this.error = err;
    if (!refetch) {
      this.untrustedData = true;
    }
    this.notifyChange();
  }

  onMutate(payload: RxQueryMutateFn<A>) {
    if (this.loading || this.untrustedData) {
      return false;
    }
    const mutated = (payload as RxQueryMutateFn<A>)(this.data);
    if (!shallowEqualDepth(mutated, this.data, 1)) {
      this.data = mutated;
      this.notifyChange();
    }
    return true;
  }

  getCurrentData(): RxQueryStatus<A> {
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

  unNotify() {
    this.stop$.next();
  }

  destroy() {
    (this.data as unknown) = null;
    this.stop$.next();
    this.stop$.complete();
    this.status$.complete();
  }
}
