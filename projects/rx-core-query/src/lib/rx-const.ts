export interface RxConst {
  maxCaching: number;
  defaultCaching: number;
  defaultRetry: number;
  defaultRetryDelay: number;
  defaultInterval: number;
  staleModeDuration: number;
  minRefetchTime: number;
}

export const getRxConstSettings = ((mutation?: Partial<RxConst>) => {
  let readonlyValue: RxConst;
  return () => {
    if (readonlyValue) return readonlyValue;
    const values = {
      maxCaching: 50,
      defaultCaching: 0,
      defaultRetry: 2,
      defaultRetryDelay: 3,
      defaultInterval: 24 * 3600,
      staleModeDuration: 300,
      minRefetchTime: 2,
    };
    if (mutation) {
      Object.entries(mutation).forEach(([key, value]: [string, number]) => {
        values[key as keyof RxConst] = value;
      });
    }
    readonlyValue = Object.freeze(values);
    return readonlyValue;
  };
})();
