import { Component, Injectable, OnDestroy } from '@angular/core';
import { RxNgService, RxNgQuery, RxNgQueryStore, RxQueryStatus } from 'rx-ng-query';
import { of, Subject, switchMap, throwError, timer } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { takeUntil } from 'rxjs/operators';
import { USER_CACHE_TYPE } from '../ngrx.component';

export const TODO_CACHE_TYPE = {
  item: 'todoItem',
  list: 'todoList',
} as const;

@Injectable()
@RxNgService()
export class AppTodoStore implements OnDestroy {
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
          selector: (res) => (res.ok ? res.json() : throwError(new Error('nope'))),
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
    paramToCachingKey(p: any) {
      return p;
    },
  })
  fetchTodoItem(num: number | null) {
    return num === null
      ? of(null)
      : fromFetch('https://jsonplaceholder.typicode.com/todos/' + num, {
          selector: (res) => (res.ok ? res.json() : throwError(new Error('nope'))),
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

  ngOnDestroy() {
    this.rxStore.unregisterStore(TODO_CACHE_TYPE.list);
    this.rxStore.unregisterStore(TODO_CACHE_TYPE.item);
  }
}

@Component({
  selector: 'ngrx-todo',
  template: `<div>
    <h2>{{ name }}</h2>
    <ng-template [rxNgSuspense]="todoItemStatus" [loadingTemplate]="loadingTemplate" let-data>
      <ul>
        <li *ngFor="let item of data">
          <a (click)="showDetail(item.id)">{{ item.title }}</a>
          <ng-container *ngIf="todoItem && todoItem.id === item.id">
            <div style="background-color: #eee;padding: 10px;">
              <dl>
                <div>
                  <dt>title</dt>
                  <dd>{{ todoItem.title }}</dd>
                </div>
                <div>
                  <dt>completed</dt>
                  <dd>{{ todoItem.completed ? 'done' : 'not yet' }}</dd>
                </div>
              </dl>
              <button (click)="closeDetail()">close</button>
            </div>
          </ng-container>
        </li>
      </ul>
    </ng-template>
    <ng-template #loadingTemplate> ... is loading </ng-template>
  </div>`,
  styleUrls: ['./ngrx-todo.component.css'],
  providers: [AppTodoStore],
})
export class NgrxTodoComponent implements OnDestroy {
  todoItemStatus: RxQueryStatus<any> | null = null;
  todoItem: any;
  name = '';
  destroy$ = new Subject<void>();
  constructor(private todoService: AppTodoStore, private rxStore: RxNgQueryStore<any>) {
    this.todoService
      .selectTodoListStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe((todoItemStatus) => {
        this.todoItemStatus = todoItemStatus;
      });
    this.todoService
      .selectTodoItem()
      .pipe(takeUntil(this.destroy$))
      .subscribe((item) => {
        console.log(item);
        this.todoItem = item;
      });
    this.rxStore
      .select(USER_CACHE_TYPE.user, (state) => state?.name || '')
      .pipe(takeUntil(this.destroy$))
      .subscribe((name) => {
        this.name = name ? `${name}'s ToDo List` : 'Something is wrong';
      });
  }
  showDetail(id: number) {
    this.todoService.fetchTodoItem(id);
  }

  closeDetail() {
    this.todoService.unselectTodoItem();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
