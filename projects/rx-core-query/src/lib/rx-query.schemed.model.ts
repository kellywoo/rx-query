import { Observable, Subject } from 'rxjs';
import { RxQueryOption } from './rx-query.model';

type RequiredOption<A, T extends keyof RxQueryOption> = Exclude<
  RxQueryOption<A>[T],
  undefined | null
>;
/**
 * @description interface without optional
 * description can be found rx-query.model.ts
 **/
export interface RxStoreOptionSchemed<A = unknown> {
  key: RequiredOption<A, 'key'>;
  initState: A;
  isEqual: RequiredOption<A, 'isEqual'>;
  retry: RequiredOption<A, 'retry'>;
  retryDelay: RequiredOption<A, 'retryDelay'>;
  keepAlive: RequiredOption<A, 'keepAlive'>;
  query: RequiredOption<A, 'query'>;
  prefetch?: RequiredOption<A, 'prefetch'> | null;
}

export interface RxQueryOptionSchemed<A = unknown>
  extends Omit<RxStoreOptionSchemed<A>, 'isStaticStore'> {
  refetchOnReconnect: RequiredOption<A, 'refetchOnReconnect'>;
  refetchOnEmerge: RequiredOption<A, 'refetchOnEmerge'>;
  refetchInterval: RequiredOption<A, 'refetchInterval'>;
  caching: RequiredOption<A, 'caching'>;
  paramToCachingKey?: (p: any) => any;
  staleTime: RequiredOption<A, 'staleTime'>;
  refetchOnBackground: RequiredOption<A, 'refetchOnBackground'>;
  dataEasing: RequiredOption<A, 'dataEasing'>;
  minValidReconnectTime: RequiredOption<A, 'minValidReconnectTime'>;
  minValidFocusTime: RequiredOption<A, 'minValidFocusTime'>;
}

export interface RxQueryNotifier {
  destroy$: Subject<string>;
  online$: Observable<boolean>;
  windowActive$: Observable<boolean>;
  isDev: boolean;
}
