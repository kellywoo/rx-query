export function autobind(target: any, key: string, descriptor: TypedPropertyDescriptor<any>) {
  let org = descriptor.value;
  return {
    configurable: false,
    get() {
      if (typeof org !== 'function' || this === target.prototype) {
        return org;
      }
      let bound = org.bind(this);
      Object.defineProperty(this, key, {
        enumerable: false,
        get() {
          return bound;
        },
        set(v) {
          bound = v.bind(this);
        },
      });
      return bound;
    },
    set(v: (...args: any) => void) {
      org = v;
    },
  };
}

const isSame = (a: any, b: any) => {
  if (typeof a !== 'number' && typeof b !== 'number') {
    return a === b;
  }
  return a === b || (isNaN(a) && isNaN(b));
};

export const deepEqual = (a: any, b: any) => {
  if (isSame(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(b, keysA[i]) ||
      !deepEqual(a[keysA[i]], b[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
};

export const shallowEqualDepth = (a: any, b: any, nth = 0) => {
  if (isSame(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !shallowEqualDepth(b[key], a[key], nth - 1)
    ) {
      return false;
    }
  }

  return true;
};
