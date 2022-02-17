import { Observable, Subject } from 'rxjs';
import { RxQueryParam } from './rx-query.model';

/**
 * @description interface without optional
 * description can be found rx-query.model.ts
 **/
export interface RxStoreOptionSchemed<A, B = A> {
  key: string;
  initState: A;
  isEqual: (a: any, b: any, nth?: number) => boolean;
  retry: number;
  retryDelay: number;
  query: (s?: B) => Observable<A>;
}

export interface RxQueryOptionSchemed<A, B>
  extends Omit<RxStoreOptionSchemed<A, B>, 'isStaticStore'> {
  prefetch?: RxQueryParam<B> | null;
  refetchOnReconnect: boolean;
  refetchOnEmerge: boolean;
  refetchInterval: number;
  keepAlive: boolean;
  caching: number;
  paramToCachingKey?: (p: any) => any;
  staleModeDuration: number;
  refetchOnStaleMode: boolean;
}

export interface RxQueryNotifier {
  destroy$: Subject<string>;
  online$: Observable<boolean>;
  visibilityChange$: Observable<boolean>;
}
