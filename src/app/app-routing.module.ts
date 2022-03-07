import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NgRxModule } from './ngrx/ngrx.module';
import { NgRxComponent } from './ngrx/ngrx.component';
import { HomeComponent } from './home/home.component';

const routes: Routes = [
  {
    path: 'home',
    component: HomeComponent,
  },
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
