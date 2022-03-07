import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgRxComponent } from './ngrx.component';
import { RxNgQueryModule } from 'rx-ng-query';
import { NgrxTodoComponent } from './ngrx-todo/ngrx-todo.component';
import { CommonModule } from '@angular/common';
import { AppUserStore } from './user.service';

@NgModule({
  imports: [CommonModule, FormsModule, RxNgQueryModule],
  declarations: [NgRxComponent, NgrxTodoComponent],
  providers: [AppUserStore],
})
export class NgRxModule {}
