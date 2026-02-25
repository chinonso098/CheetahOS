import { Directive, Output, ElementRef, EventEmitter, HostListener, Renderer2 } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[fxplrColumnResize]',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
})
export class FileExplorerColumnResizeDirective {
  private startX!: number;
  private isResizing = false;
  private initialWidth!: number;
  private columnIndex!: number;
  private table: HTMLElement | null = null; // Initialize table as null
  @Output() dataEvent = new EventEmitter<string[]>();
  @Output() mouseEvent = new EventEmitter<string>();

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.startX = event.pageX;
    this.isResizing = true;
    this.initialWidth = this.el.nativeElement.offsetWidth;
    const minimumWidths: readonly number[] = [70, 90, 90];

    // Find the index of the current column
    const row = this.el.nativeElement.parentElement;
    const cells = Array.from(row.children);
    this.columnIndex = cells.indexOf(this.el.nativeElement);

    this.renderer.addClass(this.el.nativeElement, 'resizing');
    this.renderer.addClass(document.body, 'resizing');
    this.table = this.findParentTable(this.el.nativeElement);

    if(this.table){
      const columns = this.table.querySelectorAll('th');

      const onMouseMove = (moveEvent: MouseEvent) => {
        if(this.isResizing) {
          const minimumWidth = minimumWidths[this.columnIndex] ?? minimumWidths[minimumWidths.length - 1];

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

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent){
    //emit Mouse Enter
    this.mouseEvent.emit(event.type);
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave (event: MouseEvent) {
    //emit Mouse Leave
   this.mouseEvent.emit(event.type);
  }

  private findParentTable(element: HTMLElement): HTMLElement | null {
    let current: HTMLElement | null = element;
    while (current) {
      if (current.tagName === 'TABLE') {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
}