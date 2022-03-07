import { RxNgQueryModule } from './rx-ng-query.module';
import { RxQueryOption, RxStoreOption, RxQueryOptionSchemed } from '../../../rx-core-query.main';

const INNER_DATA_KEY = Symbol();
const INNER_STORE_KEY = Symbol();

export function RxNgQuery(meta: Omit<RxQueryOption<any, any>, 'staticStore'>) {
  return function (ClassRef: any, key: string, descriptor: TypedPropertyDescriptor<any>) {
    const org = descriptor.value as RxQueryOptionSchemed<any, any>['query'];
    if (typeof org !== 'function') {
      return descriptor;
    }
    ClassRef.constructor[INNER_DATA_KEY] = ClassRef.constructor[INNER_DATA_KEY] || [];
    ClassRef.constructor[INNER_DATA_KEY].push(key);
    ClassRef.constructor[INNER_STORE_KEY] = ClassRef.constructor[INNER_STORE_KEY] || [];
    ClassRef.constructor[INNER_STORE_KEY].push(meta.key);
    return {
      configurable: false,
      enumerable: false,
      get() {
        const globalStore = RxNgQueryModule.getStore();
        const applied = org.bind(this);
        globalStore.registerStore({ ...meta, query: applied });
        const bound: (s?: any) => void = (arg?: any) => {
          return globalStore.fetch(meta.key, arg);
        };
        Object.defineProperty(this, key, {
          configurable: false,
          enumerable: false,
          get() {
            return bound;
          },
          set() {
            throw Error('does not apply setter, do not rewrite');
          },
        });
      },
      set() {
        throw Error('does not apply setter, do not rewrite');
      },
    };
  };
}

export function RxNgStore(meta: RxStoreOption<any, any>) {
  return function (ClassRef: any, key: string, descriptor: TypedPropertyDescriptor<any>) {
    const org = descriptor.value as RxStoreOption<any, any>['query'];
    if (typeof org !== 'function') {
      return descriptor;
    }
    ClassRef.constructor[INNER_DATA_KEY] = ClassRef.constructor[INNER_DATA_KEY] || [];
    ClassRef.constructor[INNER_DATA_KEY].push(key);
    ClassRef.constructor[INNER_STORE_KEY] = ClassRef.constructor[INNER_STORE_KEY] || [];
    ClassRef.constructor[INNER_STORE_KEY].push(meta.key);
    return {
      configurable: false,
      enumerable: false,
      get() {
        const globalStore = RxNgQueryModule.getStore();
        const applied = org.bind(this);
        globalStore.registerStore({ ...meta, query: applied, staticStore: true });
        const bound: (s?: any) => void = (arg?: any) => {
          return globalStore.fetch(meta.key, arg);
        };
        Object.defineProperty(this, key, {
          configurable: false,
          enumerable: false,
          get() {
            return bound;
          },
          set() {
            throw Error('does not apply setter, do not rewrite');
          },
        });
        return bound;
      },
      set() {
        throw Error('does not apply setter, do not rewrite');
      },
    };
  };
}

// https://github.com/angular/angular/issues/38966
export function RxNgService() {
  return function <
    T extends {
      new (...args: any[]): {};
      [INNER_DATA_KEY]?: string[];
      [INNER_STORE_KEY]?: string[];
    },
  >(constructor: T) {
    const destroy = constructor.prototype.ngOnDestroy;
    constructor.prototype.ngOnDestroy = function () {
      const globalStore = RxNgQueryModule.getStore();
      if (destroy) {
        destroy.apply(this);
      }
      (constructor[INNER_STORE_KEY] || []).forEach((key: string) => {
        if (globalStore.has(key)) {
          globalStore.unregisterStore(key);
        }
      });
    };
    return new Proxy(constructor, {
      construct(clz, args) {
        const instance = Reflect.construct(clz, args);
        (clz[INNER_DATA_KEY] || []).forEach((key: string) => instance[key]);
        return instance;
      },
    });
  };
}
