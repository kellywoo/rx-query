import { of } from 'rxjs';

export interface RxConst {
  maxCaching: number;
  defaultCaching: number;
  defaultRetry: number;
  defaultRetryDelay: number;
  staleTime: number;
  minValidReconnectTime: number;
  minValidFocusTime: number;
}

const DEFAULT_VALUE: RxConst = Object.freeze({
  maxCaching: 50,
  defaultCaching: 0,
  defaultRetry: 2,
  defaultRetryDelay: 3,
  staleTime: 60,
  minValidReconnectTime: 12,
  minValidFocusTime: 60,
});

export const getRxConstSettings = (() => {
  let readonlyValue: RxConst;
  return (mutation?: Partial<RxConst>) => {
    if (readonlyValue) {
      return readonlyValue;
    }
    readonlyValue = mutation ? Object.freeze({ ...DEFAULT_VALUE, ...mutation }) : DEFAULT_VALUE;
    return readonlyValue;
  };
})();

export const defaultQuery = <A>(a?: unknown) => of(a as A);
