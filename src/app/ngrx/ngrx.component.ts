import { Component } from '@angular/core';
import { AppUserStore } from './user.service';

@Component({
  selector: 'my-app',
  template: `<h1>Todo List</h1>
    <ng-template
      [rxNgSuspense]="profileStatus$ | async"
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
  profileStatus$ = this.userService.selectUserStatus();
  constructor(private userService: AppUserStore) {}

  showError(err: Error) {
    console.log(err);
  }
  toggleChild() {
    this.showTodo = !this.showTodo;
  }
}
