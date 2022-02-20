import { Component, Injectable, OnDestroy } from '@angular/core';
import { RxNgService, RxNgQuery, RxNgQueryStore, RxQueryStatus } from 'rx-ng-query';
import { Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

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
    refetchInterval: 300,
    refetchOnReconnect: true,
    refetchOnEmerge: true,
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

@Component({
  selector: 'my-app',
  template: `<h1>Todo List</h1>
    <ng-template
      [rxNgSuspense]="profileStatus"
      [loadingTemplate]="loadingTemplate"
      [errorTemplate]="errorTemplate"
      let-data
    >
      <dl>
        <dt>name</dt>
        <dd>{{ data.name }}</dd>
        <dt>email</dt>
        <dd>{{ data.email }}</dd>
        <dt>phone</dt>
        <dd>{{ data.phone }}</dd>
      </dl>
      <div>keep alive & cache (api after 1second delay)</div>
      <button type="button" (click)="toggleChild()">toggle todo</button>
      <ngrx-todo *ngIf="showTodo"></ngrx-todo>
    </ng-template>
    <ng-template #loadingTemplate>
      <div>...loading</div>
    </ng-template>
    <ng-template #errorTemplate let-err>
      <div>ErrorHappen {{ showError(err) }}</div>
    </ng-template>`,
})
export class NgRxComponent {
  showTodo = false;
  profileStatus: RxQueryStatus<any> | null = null;
  constructor(private userService: AppUserStore) {
    this.userService.selectUserStatus().subscribe((profileStatus) => {
      this.profileStatus = profileStatus;
    });
  }

  showError(err: Error) {
    console.log(err);
  }
  toggleChild() {
    this.showTodo = !this.showTodo;
  }
}
