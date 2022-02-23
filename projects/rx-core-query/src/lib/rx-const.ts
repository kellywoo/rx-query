export interface RxConst {
  maxCaching: number;
  defaultCaching: number;
  defaultRetry: number;
  defaultRetryDelay: number;
  defaultInterval: number;
  staleTime: number;
  minRefetchTime: number;
  minValidReconnectTime: number;
  minValidFocusTime: number;
}

const DEFAULT_VALUE: RxConst = Object.freeze({
  maxCaching: 50,
  defaultCaching: 0,
  defaultRetry: 2,
  defaultRetryDelay: 3,
  defaultInterval: 24 * 3600,
  staleTime: 60,
  minRefetchTime: 2,
  minValidReconnectTime: 12,
  minValidFocusTime: 60,
});

export const getRxConstSettings = ((mutation?: Partial<RxConst>) => {
  let readonlyValue: RxConst;
  return () => {
    if (readonlyValue) {
      return readonlyValue;
    }
    readonlyValue = mutation ? Object.freeze({ ...DEFAULT_VALUE, ...mutation }) : DEFAULT_VALUE;
    return readonlyValue;
  };
})();
