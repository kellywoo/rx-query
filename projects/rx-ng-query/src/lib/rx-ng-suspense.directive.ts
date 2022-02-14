import {
  Directive,
  Input,
  OnChanges,
  Self,
  SimpleChanges,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { RxQueryStatus } from 'rx-core-query';

export type TemplateType = 'null' | 'loading' | 'content' | 'error';
@Directive({
  selector: '[rxNgSuspense]',
})
export class RxNgSuspenseDirective implements OnChanges {
  @Input() loadingTemplate: TemplateRef<any> | null = null;
  @Input() errorTemplate: TemplateRef<any> | null = null;
  @Input() rxNgSuspense: RxQueryStatus<any> | null = null;
  @Input() templateSort?: (s: RxQueryStatus<any>) => TemplateType;
  appliedTemplate: TemplateRef<any> | null = null;
  constructor(
    @Self() private contentTemplate: TemplateRef<any>,
    private viewContainerRef: ViewContainerRef,
  ) {}

  getType(status: RxQueryStatus<any>) {
    const { loading, data, error, untrustedData } = status;
    if (untrustedData) {
      if (error) {
        return 'error';
      }
      if (loading) {
        return 'loading';
      }

      return data ? 'content' : 'null';
    }

    if (data) {
      return 'content';
    }
    return 'null';
  }

  ngOnChanges(changes: SimpleChanges) {
    const type: TemplateType = this.rxNgSuspense
      ? (this.templateSort || this.getType)(this.rxNgSuspense)
      : 'null';
    if (!this.rxNgSuspense) {
      this.viewContainerRef.clear();
      return;
    }
    const newTemplateRef = this.getTemplate(type);
    if (newTemplateRef !== this.appliedTemplate) {
      this.viewContainerRef.clear();
      this.appliedTemplate = newTemplateRef;
      if (newTemplateRef) {
        switch (type) {
          case 'content':
            this.viewContainerRef.createEmbeddedView(newTemplateRef, {
              $implicit: this.rxNgSuspense.data,
            });
            break;
          case 'error':
            this.viewContainerRef.createEmbeddedView(newTemplateRef, {
              $implicit: this.rxNgSuspense.error,
            });
            break;
          default:
            this.viewContainerRef.createEmbeddedView(newTemplateRef);
            break;
        }
      }
    } else if (changes['rxNgSuspense'] && this.appliedTemplate === this.contentTemplate) {
      const viewRef = this.viewContainerRef.get(0) as any;
      if (viewRef && viewRef.context.$implicit !== this.rxNgSuspense.data) {
        viewRef.context.$implicit = this.rxNgSuspense.data;
        viewRef.detectChanges();
      }
    }
  }

  getTemplate(type: TemplateType) {
    switch (type) {
      case 'content':
        return this.contentTemplate;
      case 'error':
        return this.errorTemplate;
      case 'loading':
        return this.loadingTemplate;
      default:
        return null;
    }
  }
}
