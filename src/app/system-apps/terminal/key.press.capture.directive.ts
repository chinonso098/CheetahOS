import { Directive, ElementRef, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { buffer, debounceTime, filter } from 'rxjs/operators';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[appKeyPressCapture]',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class KeyPressCaptureDirective implements OnInit, OnDestroy {
  @Output() keyDblPressed = new EventEmitter<KeyboardEvent>();
  private keyPressSubscription!: Subscription;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    const keyPress$ = fromEvent<KeyboardEvent>(this.el.nativeElement, 'keydown');

    this.keyPressSubscription = keyPress$
      .pipe(
        buffer(keyPress$.pipe(debounceTime(300))),
        filter(events => events.length === 2)
      )
      .subscribe(events => {
        //console.log('events-keyPress$:', events );
        //this.keyDblPressed.emit(events.length);
        if(events[0].key === events[1].key)
            this.keyDblPressed.emit(events[0]);
      });
  }

  ngOnDestroy() {
    if (this.keyPressSubscription) {
      this.keyPressSubscription.unsubscribe();
    }
  }
}
