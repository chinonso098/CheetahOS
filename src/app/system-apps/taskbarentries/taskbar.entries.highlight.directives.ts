/* eslint-disable @angular-eslint/prefer-standalone */
import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[taskBarEntryHighlight]',
  standalone: false
})
export class TaskBarEntryHighlightDirective {

  constructor(private el: ElementRef) { }

  backgroundColor = 'hsl(206deg 77% 45%/20%)';

  @HostListener('mouseenter') onMouseEnter() {
    this.highlight(this.backgroundColor);
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.highlight(''); 
  }

  private highlight(color: string){
    this.el.nativeElement.style.backgroundColor = color;
  }
}

