import { Injectable } from '@angular/core';
import { distinctUntilChanged, fromEvent, map, merge, Observable, share, Subject } from 'rxjs';
import {
  RxQuery,
  RxQueryOption,
  RxQueryStatus,
  autobind,
  RxStore,
  RxStoreAbstract,
  RxQueryNotifier,
  RxState,
  RxQueryMutateFn,
} from '../../../rx-core-query.main';

export interface RxNgState {
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class RxNgQueryStore<A extends RxNgState> {
  isDev = false;
  private state: Partial<{ [key in keyof A]: RxStoreAbstract<any, any> }> = {};
  private caches: Partial<{ [key in keyof A]: RxState }> = {};
  private online$ = merge(fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
    map((e) => e.type === 'online'),
    share(),
  );
  private visibilityChange$ = fromEvent(document, 'visibilitychange').pipe(
    map(() => document.visibilityState === 'visible'),
    distinctUntilChanged(),
    share(),
  );
  private notifiers: RxQueryNotifier = Object.freeze({
    destroy$: new Subject<string>(),
    online$: this.online$,
    visibilityChange$: this.visibilityChange$,
  });

  constructor() {
    this.notifiers.destroy$!.subscribe((key) => {
      const store = this.state[key];
      if (store) {
        const cache = store.getKeepAlivedState();
        if (cache) {
          this.caches[key as keyof A] = cache;
        } else {
          if (this.caches[key]) {
            delete this.caches[key];
          }
        }
        delete this.state[key];
      }
    });
  }

  @autobind
  registerStore(options: RxQueryOption<any, any>) {
    const key = options.key as keyof A;
    if (this.state[key]) {
      console.warn(
        `${key} store already exists. retrieve the existing. If you want new store, choose different key`,
      );
      return;
    }
    const cache = this.caches[key];
    this.state[key] = options.staticStore
      ? new RxStore(options, this.notifiers, cache)
      : new RxQuery(options, this.notifiers, cache);
  }

  private getStore(key: keyof A) {
    if (this.state[key]) {
      return this.state[key] as RxStoreAbstract<any, any>;
    }
    throw Error(`the store of key(${key}) seems not existing.`);
  }

  @autobind
  public has(key: keyof A) {
    return Boolean(this.state[key]);
  }

  @autobind
  public unregisterStore(key: keyof A) {
    this.getStore(key).destroy();
  }

  @autobind
  public getInitData(key: keyof A) {
    return this.getStore(key).getInitData();
  }

  @autobind
  public reset(key: keyof A) {
    return this.getStore(key).reset();
  }

  @autobind
  public select<S, T extends keyof A>(key: T, selector?: (s: Pick<A, T>[T]) => S): Observable<S> {
    return this.getStore(key).select(selector);
  }

  @autobind
  public status<S, T extends keyof A>(key: T): Observable<RxQueryStatus<S>> {
    return this.getStore(key).status();
  }

  @autobind
  public mutate<T extends keyof A>(key: T, payload: RxQueryMutateFn<Pick<A, T>[T]>): boolean {
    return this.getStore(key).mutate(payload);
  }

  @autobind
  public fetch<T extends keyof A>(key: T, param?: any) {
    return this.getStore(key).fetch(param);
  }

  @autobind
  public reload<T extends keyof A>(key: T) {
    return this.getStore(key).reload();
  }

  @autobind
  public disableRefetch<T extends keyof A>(key: T, disable: boolean) {
    this.getStore(key).disableRefetch?.(disable);
  }
}
