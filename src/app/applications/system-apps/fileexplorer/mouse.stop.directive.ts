import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[MouseStop]',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone: false,
})
export class MouseStopDirective implements OnDestroy {
  /**
   * Delay in ms before considering the mouse "stopped".
   */
  @Input() mouseStopDelay = 120;

  /**
   * Emits only the last mousemove event after movement stops.
   */
  @Output() mouseStop = new EventEmitter<MouseEvent>();

  private lastMouseMoveEvent: MouseEvent | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private isInside = false;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(_: MouseEvent): void {
    this.isInside = true;
    this.clearTimer();
    this.lastMouseMoveEvent = null;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isInside) {
      return;
    }

    this.lastMouseMoveEvent = event;
    this.clearTimer();

    this.stopTimer = setTimeout(() => {
      if (this.isInside && this.lastMouseMoveEvent) {
        this.mouseStop.emit(this.lastMouseMoveEvent);
      }
    }, this.mouseStopDelay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.isInside = false;
    this.lastMouseMoveEvent = null;
    this.clearTimer();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }
}