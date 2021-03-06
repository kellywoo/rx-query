import { distinctUntilChanged, fromEvent, map, merge, Observable, share, Subject } from 'rxjs';
import {
  RxQuery,
  RxQueryOption,
  RxQueryStatus,
  autobind,
  RxStore,
  RxStoreAbstract,
  RxQueryNotifier,
  RxQueryMutateFn,
  RxQueryResponse,
  RxConst,
  getRxConstSettings,
  RxCacheManager,
} from '../../../rx-core-query.main';

export type RxNgState = Record<string, any>;

export type RxNgQueryStoreConfig = Partial<RxQueryNotifier & RxConst>;

export class RxNgQueryStore<A extends RxNgState> {
  private state: { [key in keyof A]?: RxStoreAbstract } = {};
  private online$ = merge(fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
    map((e) => e.type === 'online'),
    share(),
  );
  private windowActive$ = fromEvent(document, 'visibilitychange').pipe(
    map(() => document.visibilityState === 'visible'),
    distinctUntilChanged(),
    share(),
  );
  private cacheManager: RxCacheManager;
  private notifiers: RxQueryNotifier = Object.seal({
    destroy$: new Subject<string>(),
    online$: this.online$,
    windowActive$: this.windowActive$,
    isDev: false,
  });

  private updateConfig(config?: RxNgQueryStoreConfig) {
    if (!config) return;
    const notifierKeys = Object.keys(this.notifiers);
    const rxConst: Partial<RxConst> = {};
    Object.entries(config).forEach(([key, value]) => {
      if (notifierKeys.includes(key) && value instanceof Observable) {
        this.notifiers[key as keyof RxQueryNotifier] = value as any;
      } else {
        rxConst[key as keyof RxConst] = value as any;
      }
    });
    if (Object.keys(rxConst).length) {
      getRxConstSettings(rxConst);
    }
  }

  constructor(config?: RxNgQueryStoreConfig) {
    this.cacheManager = new RxCacheManager();
    this.updateConfig(config);
    this.notifiers.destroy$.subscribe((key: string) => {
      const store = this.state[key];
      if (store) {
        delete this.state[key];
      }
    });
  }

  @autobind
  public registerStore(options: RxQueryOption) {
    const key = options.key as keyof A;
    if (this.state[key]) {
      console.warn(
        `${key} store already exists. retrieve the existing. If you want new store, choose different key`,
      );
      return;
    }
    this.state[key] = options.staticStore
      ? new RxStore(options, this.notifiers, this.cacheManager)
      : new RxQuery(options, this.notifiers, this.cacheManager);
  }

  private getStore<T extends keyof A>(key: T) {
    if (this.state[key]) {
      return this.state[key] as RxStoreAbstract<Pick<A, T>[T]>;
    }
    throw TypeError(`the store of key(${key}) seems not existing.`);
  }

  @autobind
  public has<T extends keyof A>(key: T) {
    return Boolean(this.state[key]);
  }

  @autobind
  public unregisterStore<T extends keyof A>(key: T) {
    this.getStore<T>(key).destroy();
  }

  @autobind
  public getInitData<T extends keyof A>(key: T) {
    return this.getStore<T>(key).getInitData();
  }

  @autobind
  public reset<T extends keyof A>(key: T) {
    return this.getStore<T>(key).reset();
  }

  @autobind
  public select<S, T extends keyof A>(key: T, selector?: (s: Pick<A, T>[T]) => S): Observable<S> {
    return this.getStore<T>(key).select(selector);
  }

  @autobind
  public status<S, T extends keyof A>(key: T): Observable<RxQueryStatus<S>> {
    return this.getStore<T>(key).status();
  }

  @autobind
  public response<S, T extends keyof A>(key: T): Observable<RxQueryResponse<S>> {
    return this.getStore(key).response();
  }

  @autobind
  public mutate<T extends keyof A>(key: T, payload: RxQueryMutateFn<Pick<A, T>[T]>): boolean {
    return this.getStore<T>(key).mutate(payload);
  }

  @autobind
  public fetch<T extends keyof A>(key: T, param?: any) {
    return this.getStore<T>(key).fetch(param);
  }

  @autobind
  public reload<T extends keyof A>(key: T) {
    return this.getStore<T>(key).reload();
  }

  @autobind
  public disableRefetch<T extends keyof A>(key: T, disable: boolean) {
    this.getStore<T>(key).disableRefetch?.(disable);
  }
}
