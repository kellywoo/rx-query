import { Component, OnDestroy } from '@angular/core';
import { RxNgQueryStore, RxQueryStatus } from 'rx-ng-query';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { USER_CACHE_TYPE } from '../user.service';
import { AppTodoStore } from './todo.service';

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
    this.destroy$.next(undefined);
    this.destroy$.complete();
  }
}
