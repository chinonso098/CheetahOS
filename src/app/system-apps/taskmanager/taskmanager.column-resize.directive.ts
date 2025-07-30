import { Directive, Output, ElementRef, EventEmitter, HostListener, Renderer2 } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[columnResize]',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class ColumnResizeDirective {
  private startX!: number;
  private isResizing = false;
  private initialWidth!: number;
  private columnIndex!: number;
  private table: HTMLElement | null = null; // Initialize table as null
  @Output() dataEvent = new EventEmitter<string[]>();

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.startX = event.pageX;
    this.isResizing = true;
    this.initialWidth = this.el.nativeElement.offsetWidth;
    const minimumWidths:number[] = [124,91,81];
    let minimumWidth = 0;

    //console.log("this.initialWidth:", this.initialWidth);


    // Find the index of the current column
    const row = this.el.nativeElement.parentElement;
    const cells = Array.from(row.children);
    this.columnIndex = cells.indexOf(this.el.nativeElement);

    this.renderer.addClass(this.el.nativeElement, 'resizing');
    this.renderer.addClass(document.body, 'resizing');
    this.table = this.findParentTable(this.el.nativeElement);

    if (this.table) {
      const columns = this.table.querySelectorAll('th');

      const onMouseMove = (moveEvent: MouseEvent) => {
        if(this.isResizing) {
          minimumWidth = (this.columnIndex === 0)? minimumWidths[0] : minimumWidths[1]

          if(this.columnIndex === 0){
            minimumWidth =  minimumWidths[0];
          }else if(this.columnIndex === 1){
            minimumWidth = minimumWidths[1];
          }else{
            minimumWidth = minimumWidths[3];
          }

          const deltaX = moveEvent.pageX - this.startX;
          const newWidth = this.initialWidth + deltaX;

          if(newWidth >= minimumWidth){
            // Update the width of the current column
            this.renderer.setStyle(this.el.nativeElement, 'min-width', newWidth + 'px');
            this.renderer.setStyle(this.el.nativeElement, 'width', newWidth + 'px');

            // Update the width of the corresponding header and cell in each row
            columns[this.columnIndex].style.minWidth = `${newWidth}px`;
            columns[this.columnIndex].style.width = `${newWidth}px`;

            //emit column being resized
            this.dataEvent.emit([`th-${this.columnIndex}`, `${newWidth}`]);

            const rows = this.table?.querySelectorAll('tr');
            //console.log("row count:", rows);

            rows?.forEach((row) => {
              const cells = row.querySelectorAll('td');
              if (cells[this.columnIndex]) {
                cells[this.columnIndex].style.minWidth = `${newWidth}px`;
                cells[this.columnIndex].style.width = `${newWidth}px`;
              }
            });
          }
        }
      };

      const onMouseUp = () => {
        this.isResizing = false;
        this.renderer.removeClass(this.el.nativeElement, 'resizing');
        this.renderer.removeClass(document.body, 'resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
  }

  private findParentTable(element: HTMLElement): HTMLElement | null {
    while (element) {
      if (element.tagName === 'TABLE') {
        return element;
      }
      if (element?.parentElement) element = element.parentElement;
    }
    return null;
  }
}