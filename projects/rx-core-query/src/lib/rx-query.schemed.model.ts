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
  query: (s?: B) => Observable<A>;
}

export interface RxQueryOptionSchemed<A, B>
  extends Omit<RxStoreOptionSchemed<A, B>, 'isStaticStore'> {
  prefetch?: RxQueryParam<B> | null;
  refetchOnReconnect: boolean;
  refetchOnEmerge: boolean;
  refetchInterval: number;
  retry: number;
  retryDelay: number;
  keepAlive: boolean;
  caching: number;
  paramToCachingKey?: (p: any) => any;
  backgroundStaleTime: number;
  backgroundRefetch: boolean;
}

export interface RxQueryNotifier {
  destroy$: Subject<string>;
  online$: Observable<boolean>;
  visibilityChange$: Observable<boolean>;
}
