/* eslint-disable @angular-eslint/prefer-standalone */
import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[appHighlight]',
  standalone:false,
})
export class HighlightDirective {

  constructor(private el: ElementRef) { }

  color = 'rgb(26,26,26)';
  closeBtnColor = 'rgb(232,17,35)';
  focusedCloseBtnColor = 'rgb(139,10,20)';
  unfocusedWindowColor = 'rgb(56,56,56)'; 

  @HostListener('mouseenter') 
  onMouseEnter() {
    this.highlight(this.color, this.closeBtnColor);
  }

  @HostListener('mouseleave') 
  onMouseLeave() {
    this.highlight('','');
  }

  @HostListener("focus")
  private highlight(color: string, xBtnColor:string) {
    
    if(this.el.nativeElement.id == "closeBtn"){
      this.el.nativeElement.style.backgroundColor = xBtnColor;
      this.el.nativeElement.style.transition = 'background-color 0.3s ease';
      this.el.nativeElement.focus();
    }
    else if (this.el.nativeElement.id == "hideBtn" || this.el.nativeElement.id == "minBtn" || this.el.nativeElement.id == "maxBtn"){
      this.el.nativeElement.style.backgroundColor = color;
      this.el.nativeElement.focus();
    }

  }
}
