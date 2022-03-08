import { Observable, Subject } from 'rxjs';
import { RxQueryParam } from './rx-query.model';

/**
 * @description interface without optional
 * description can be found rx-query.model.ts
 **/
export interface RxStoreOptionSchemed<A = unknown> {
  key: string;
  initState: A;
  isEqual: (a: any, b: any, nth?: number) => boolean;
  retry: number;
  retryDelay: number;
  keepAlive: boolean;
  query: (s?: unknown) => Observable<A> | Promise<A>;
  prefetch?: RxQueryParam | null;
}

export interface RxQueryOptionSchemed<A = unknown>
  extends Omit<RxStoreOptionSchemed<A>, 'isStaticStore'> {
  refetchOnReconnect: boolean;
  refetchOnEmerge: boolean;
  refetchInterval: number;
  caching: number;
  paramToCachingKey?: (p: any) => any;
  staleTime: number;
  refetchOnBackground: boolean;
  dataEasing: boolean;
  minValidReconnectTime: number;
  minValidFocusTime: number;
}

export interface RxQueryNotifier {
  destroy$: Subject<string>;
  online$: Observable<boolean>;
  windowActive$: Observable<boolean>;
  isDev: boolean;
}
