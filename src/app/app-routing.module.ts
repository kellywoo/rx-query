import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgRxModule } from './ngrx/ngrx.module';
import { NgRxComponent } from './ngrx/ngrx.component';

const routes: Routes = [
  {
    path: '**',
    component: NgRxComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes), NgRxModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
