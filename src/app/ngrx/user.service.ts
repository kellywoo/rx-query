import { Injectable, OnDestroy } from '@angular/core';
import { RxNgQuery, RxNgQueryStore, RxNgService, RxQueryStatus } from 'rx-ng-query';
import { fromFetch } from 'rxjs/fetch';
import { Observable } from 'rxjs';

export const USER_CACHE_TYPE = {
  user: 'user',
} as const;

@Injectable()
@RxNgService()
export class AppUserStore implements OnDestroy {
  constructor(private rxStore: RxNgQueryStore<any>) {
    // static manual store..
    this.rxStore.registerStore({
      key: 'static',
      initState: 3,
      staticStore: true,
    });
  }

  @RxNgQuery({
    key: USER_CACHE_TYPE.user,
    prefetch: { param: null },
    staleCheckOnInterval: true,
    staleCheckOnReconnect: true,
    staleCheckOnFocus: true,
    initState: null,
  })
  fetchUser() {
    return fromFetch('https://jsonplaceholder.typicode.com/users/1', {
      selector: (res) => {
        return res.json();
      },
    });
  }

  selectUserStatus(): Observable<RxQueryStatus<any>> {
    // to get data and api meta info
    return this.rxStore.status(USER_CACHE_TYPE.user);
  }

  ngOnDestroy() {
    this.rxStore.unregisterStore(USER_CACHE_TYPE.user);
  }
}
