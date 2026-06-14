import { Constants } from 'src/app/system-files/constants';
import { IState } from './terminal.types';

/**
 * Holds all state for the terminal's TAB-completion engine.
 *
 * Context
 * -------
 * The terminal supports two kinds of commands for tab completion:
 *
 *   - Single-argument commands (cd, rm, download, ...)
 *       Uses "Section 0" only.
 *
 *   - Two-argument commands   (cp, mv)
 *       Uses Section 0 (source path) and Section 1 (destination path).
 *       The user tabs through completions in one section, presses
 *       SPACE to move on, then tabs through the next section.
 *
 * A "section" remembers
 *   - the cursor position at which TAB was pressed,
 *   - the path the user was typing,
 *   - and where in the cycling completion list we were.
 *
 * The component switches between sections based on cursor position
 * (ArrowLeft / ArrowRight) and on repeated TAB presses.
 *
 * Field naming convention
 * -----------------------
 *   currentState : 'S1' = single-section mode, 'S2' = two-section mode.
 *   firstSection / secondSection : exactly one is "active" in S2 mode,
 *       telling the loop logic which slot to write into.
 *   inLoopState : true once we've fetched the directory listing and are
 *       cycling through completions on subsequent TAB presses.
 *
 * NOTE: This class was extracted from TerminalComponent. The algorithm
 * is intentionally preserved 1:1 with the previous inline fields; only
 * the typo `swtichToNextSection` -> `switchToNextSection` and the
 * abbreviated `Cntr` -> `Counter` suffixes were corrected during the
 * move.
 */
export class TabCompletionState {
  // ---- mode labels --------------------------------------------------------

  /** "Single section" mode (only one path argument expected). */
  static readonly STATE_ONE = 'S1';
  /** "Two section" mode (source + destination, e.g. cp / mv). */
  static readonly STATE_TWO = 'S2';

  // ---- per-section snapshots ---------------------------------------------

  /**
   * Per-section snapshots (cursor position, typed path, cycling index).
   * Pushed by `createSection` and rewritten by `updateSection`.
   */
  sections: IState[] = [];

  // ---- mode tracking ------------------------------------------------------

  /** Current mode: STATE_ONE or STATE_TWO. */
  currentState: string = TabCompletionState.STATE_ONE;

  /** Section flags. In STATE_ONE only firstSection matters. */
  firstSection = true;
  secondSection = false;

  /**
   * Set to true once the user types a SPACE after the source path in a
   * cp/mv command, signalling "the next TAB acts on section 1".
   *
   * (Previously misspelt as `swtichToNextSection`.)
   */
  switchToNextSection = false;

  /** Counts TAB presses to drive the section-1 hand-off on cp / mv. */
  sectionTabPressCounter = 0;

  /**
   * Per-section first-tab indicators. They start at -1 so the first
   * hit goes to a re-fetch branch, then transition to 0/positive.
   */
  firstSectionCounter = -1;
  secondSectionCounter = -1;

  // ---- per-keystroke flags ------------------------------------------------

  /**
   * True after we've fetched the directory listing for the current
   * argument and are cycling through it on subsequent TABs.
   */
  inLoopState = false;

  /**
   * Trailing-whitespace flag for the current input. Controls whether
   * `removeCurrentDir()` returns the path unchanged.
   */
  isWhitespaceAtEnd = false;

  // ---- memoisation for evaluateChangeDirectoryRequest --------------------

  /**
   * Last `rootArg` seen by `evaluateChangeDirectoryRequest`. Used to
   * avoid re-applying the same single-match completion repeatedly,
   * which would otherwise clobber the form value with an identical
   * string each keystroke.
   */
  lastSeenRootArg = Constants.EMPTY_STRING;

  /** Last single-match auto-complete string applied to the form. */
  lastSeenAutoComplete = Constants.EMPTY_STRING;

  // ---- traversal cache ----------------------------------------------------

  /** Cycling index into `fetchedDirectoryList`. */
  dirEntryTraverseCounter = 0;

  /**
   * Number of "/" segments in the resolved directory. Affects whether
   * the form value should preserve a prefix path when cycling.
   */
  directoryTraversalDepth = 0;

  /** Cached directory listing for the most recent TAB traversal. */
  fetchedDirectoryList: string[] = [];

  // ---- helpers ------------------------------------------------------------

  /** Number of sections currently tracked. */
  get sectionCount(): number {
    return this.sections.length;
  }

  /** Push a fresh per-section snapshot. */
  createSection(cursorPos: number, idxSec = 0): void {
    this.sections.push({
      cursorPosition: cursorPos,
      indexSection: idxSec,
      dirEntryTraverseCntr: 0,
      currentPath: Constants.BLANK_SPACE
    });
  }

  /**
   * Update an existing section snapshot in place.
   * No-op when `idx` is out of range — preserves legacy behaviour.
   */
  updateSection(idx: number, cursorPos: number, rootArg: string): void {
    const slot = this.sections[idx];
    if (!slot) return;
    slot.cursorPosition = cursorPos;
    slot.currentPath = rootArg;
    slot.dirEntryTraverseCntr = this.dirEntryTraverseCounter;
  }

  /**
   * Reset per-command state. Called after Enter so each new command
   * starts with a clean tab-completion context.
   *
   * Intentionally does NOT clear:
   *   - `sections` (legacy behaviour — was never cleared in the
   *     previous implementation; left as-is to avoid changing semantics).
   *   - `lastSeenRootArg` / `lastSeenAutoComplete` — these memoise
   *     across keystrokes and were not reset previously either.
   */
  reset(): void {
    this.firstSection = true;
    this.secondSection = false;
    this.sectionTabPressCounter = 0;
    this.firstSectionCounter = -1;
    this.secondSectionCounter = -1;
    this.currentState = TabCompletionState.STATE_ONE;
    this.switchToNextSection = false;
    this.fetchedDirectoryList = [];
  }
}
