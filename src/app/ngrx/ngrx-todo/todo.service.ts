import { RxNgQuery, RxNgQueryStore, RxNgService } from 'rx-ng-query';
import { Injectable, OnDestroy } from '@angular/core';
import { of, switchMap, throwError, timer } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

export const TODO_CACHE_TYPE = {
  item: 'todoItem',
  list: 'todoList',
} as const;

@RxNgService()
@Injectable()
export class AppTodoStore {
  constructor(private rxStore: RxNgQueryStore<any>) {}

  @RxNgQuery({
    key: TODO_CACHE_TYPE.list,
    prefetch: { param: null },
    keepAlive: true,
    refetchOnReconnect: true,
    initState: [],
  })
  fetchTodoList() {
    return timer(1000).pipe(
      switchMap(() =>
        fromFetch('https://jsonplaceholder.typicode.com/todos', {
          selector: (res) => (res.ok ? res.json() : throwError(() => new Error('nope'))),
        }),
      ),
    );
  }

  @RxNgQuery({
    key: TODO_CACHE_TYPE.item,
    initState: null,
    caching: 30,
    keepAlive: true,
    dataEasing: true,
    paramToCachingKey(num: number | null) {
      return num;
    },
  })
  fetchTodoItem(num: number | null) {
    return num === null
      ? of(null)
      : fromFetch('https://jsonplaceholder.typicode.com/todos/' + num, {
          selector: (res) => (res.ok ? res.json() : throwError(() => new Error('nope'))),
        });
  }

  unselectTodoItem() {
    this.fetchTodoItem(null);
  }

  selectTodoItem() {
    return this.rxStore.select(TODO_CACHE_TYPE.item);
  }

  selectTodoListStatus() {
    return this.rxStore.status(TODO_CACHE_TYPE.list);
  }
}
