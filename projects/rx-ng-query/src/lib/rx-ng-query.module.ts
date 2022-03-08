import { InjectionToken, Injector, ModuleWithProviders, NgModule, Optional } from '@angular/core';
import { RxNgQueryStore, RxNgQueryStoreConfig } from './rx-ng-query.store';
import { RxNgSuspenseDirective } from './rx-ng-suspense.directive';
import { RxQueryOption } from '../../../rx-core-query.main';

let STORE: RxNgQueryStore<any>;
const StoreInitToken = new InjectionToken('@@@@::ng_query_init');
export const StoreConfigToken = new InjectionToken('@@@@::ng_query_config');

const ngQueryStoreProvider = {
  provide: RxNgQueryStore,
  useFactory: (config?: RxNgQueryStoreConfig, initSource?: any) => {
    if (!STORE) {
      STORE = new RxNgQueryStore(config);
    }
    if (initSource) {
      initSource.forEach((source: RxQueryOption) => {
        if (!STORE.has(source.key)) {
          STORE.registerStore(source);
        }
      });
    }
    return STORE;
  },
  deps: [
    [new Optional(), StoreConfigToken],
    [new Optional(), StoreInitToken],
  ],
};

@NgModule({
  declarations: [RxNgSuspenseDirective],
  exports: [RxNgSuspenseDirective],
  providers: [ngQueryStoreProvider],
})
export class RxNgQueryModule {
  static getStore() {
    return STORE;
  }

  static withInitStore(
    source?: (...args: any[]) => RxQueryOption[],
    deps?: any[],
  ): ModuleWithProviders<RxNgQueryModule> {
    return {
      ngModule: RxNgQueryModule,
      providers: [
        {
          provide: StoreInitToken,
          useFactory(injector: Injector) {
            if (source) {
              return deps ? source(...deps.map((type) => injector.get(type))) : source();
            }
            return [];
          },
          deps: [Injector],
        },
        ngQueryStoreProvider,
      ],
    };
  }
}
