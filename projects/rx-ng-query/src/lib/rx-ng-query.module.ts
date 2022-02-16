import { InjectionToken, Injector, ModuleWithProviders, NgModule, Optional } from '@angular/core';
import { RxNgQueryStore } from './rx-ng-query.store';
import { RxNgSuspenseDirective } from './rx-ng-suspense.directive';
import { RxQueryOption } from '../../../rx-core-query.main';

const STORE = new RxNgQueryStore<any>();
const StoreInitToken = new InjectionToken('@@@@::ng_query_init');
export const StoreDevToken = new InjectionToken('@@@@::ng_is_dev');

@NgModule({
  declarations: [RxNgSuspenseDirective],
  exports: [RxNgSuspenseDirective],
  providers: [
    {
      provide: RxNgQueryStore,
      useFactory: (init?: any, isDev?: boolean) => {
        STORE.isDev = isDev || false;
        return STORE;
      },
      deps: [
        [new Optional(), StoreInitToken],
        [new Optional(), StoreDevToken],
      ],
    },
  ],
})
export class RxNgQueryModule {
  static getStore() {
    return STORE;
  }

  static withInitStore<A>(
    source?: (...args: any[]) => RxQueryOption<any, any>[],
    deps?: any[],
  ): ModuleWithProviders<RxNgQueryModule> {
    return {
      ngModule: RxNgQueryModule,
      providers: [
        {
          provide: StoreInitToken,
          useFactory(injector: Injector) {
            if (source) {
              const initSource = deps
                ? source(...deps.map((type) => injector.get(type)))
                : source();
              initSource.forEach((sc) => {
                STORE.registerStore(sc);
              });
            }
            return true;
          },
          deps: [Injector],
        },
        {
          provide: RxNgQueryStore,
          useFactory(init: any, isDev = false) {
            STORE.isDev = isDev;
            return STORE;
          },
          deps: [StoreInitToken, [new Optional(), StoreDevToken]],
        },
      ],
    };
  }
}
