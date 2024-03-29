import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[fileMngrHighlight]'
})
export class FlieManagerHighlightDirective {

  constructor(private el: ElementRef) { }

  backgroundColor = 'hsl(206deg 77% 70%/20%)';
  border = '2px solid hsla(0,0%,50%,25%)'
  padding = '0'

  @HostListener('mouseenter') onMouseEnter() {
    this.highlight(this.backgroundColor,this.border, this.padding);
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.highlight('transparent','transparent','transparent');
  }

  private highlight(color: string, border:string, paddding:string) {

    this.el.nativeElement.style.backgroundColor = color;
    this.el.nativeElement.style.border = border;
    this.el.nativeElement.style.padding = paddding;
  }
}
