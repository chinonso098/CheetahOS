/* eslint-disable @angular-eslint/prefer-standalone */
import { Directive } from '@angular/core';

/**
 * NOTE: This directive used to write `element.style.backgroundColor` on
 * `mouseenter` / `mouseleave`. It conflicted with the component-side focus
 * highlight (its mouseleave handler wiped whatever colour the component had
 * set), producing a flicker when the user moused over a neighbouring icon.
 *
 * Hover styling now lives entirely in `taskbarentries.component.css` via the
 * `:hover` pseudo-class plus the model-bound `.is-active` / `.is-focused`
 * state classes. The directive is kept as an inert no-op only so that the
 * AppModule declaration (`TaskBarEntryHighlightDirective`) and any straggler
 * `taskBarEntryHighlight` selector in templates still resolve. Safe to delete
 * the directive registration entirely in a follow-up sweep.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[taskBarEntryHighlight]',
  standalone: false
})
export class TaskBarEntryHighlightDirective {}


