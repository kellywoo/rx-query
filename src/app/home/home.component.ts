import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-home',
  template: 'this is home',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {}
