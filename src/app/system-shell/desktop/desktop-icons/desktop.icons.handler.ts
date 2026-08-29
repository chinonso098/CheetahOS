import { Injectable, NgZone } from '@angular/core';
import { FileService } from 'src/app/shared/system-service/file.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { DesktopIconsHandlerInit, IconsSizes, mousePosition } from '../desktop.types';
import { DesktopIconAlignmentHelper } from '../desktop.icon.alignment.helper';
import { DesktopStyleHelper } from '../desktop.style.helper';
import { SortBys } from 'src/app/system-files/commons/common.enums';
import { DragEventInfo } from 'src/app/system-files/commons/common.interfaces';



/**
 * DesktopIcons (display surface) — extracted from DesktopComponent
 * (§1.1.4).
 *
 * Handler ownership by sub-stage:
 *   - §1.1.4.1: view modes (large / medium / small), sort modes,
 *                            auto-align / auto-arrange flags,
 *                            icon visibility (`showDesktopIcons`),
 *                            icon-size styles and the grid-size
 *                            constants that drive them.
 *   - §1.1.4.2:              selection (click / hover / highlight,
 *                            marked-IDs, multi-select lasso).
 *   - §1.1.4.3 (this stage): drag source handlers + icon repositioning
 *                            (`isDragFromDesktopActive`,
 *                            `draggedElementId`, `movedBtnIds`,
 *                            `onDragStart`/`onDragOver`/`onDragEnd`,
 *                            `moveBtnIconsToNewPositionAlignOff/On`).
 *
 * Provided at the COMPONENT scope (in DesktopComponent.providers) for
 * consistency with DesktopBackgroundHandler and TaskbarMenuHandler.
 *
 * State is exposed as public fields (NOT getters) so the template can
 * bind to them directly via `iconsHandler.<field>` and the component
 * can read/write the few fields (`currIconId`, `markedBtnIds`, etc.)
 * that are still needed by code awaiting later sub-stages (rename in
 * §1.1.4.5, delete in §1.1.4.5).
 */
@Injectable()
export class DesktopIconsHandler {

    /**
     * Both services are `providedIn: 'root'` so injecting them here is
     * cheap and side-effect-free: the handler gets the same singleton
     * the component has. Drag-source code (§1.1.4.3) calls
     * `_fileService.addDragAndDropFile` / `removeDragAndDropFile` and
     * `_systemNotificationService.setDropEventInfo` /
     * `getDragEventInfo` / `removeDragEventInfo` directly — no bridge
     * needed since the handler owns its dependencies.
     */
    constructor(
        private readonly _fileService: FileService,
        private readonly _systemNotificationService: SystemNotificationService,
        // §3.A — used to register the lasso `mousemove` listener
        // outside Angular's zone so each pixel of mouse movement does
        // NOT trigger a full change-detection cycle.  Re-entry into
        // the zone happens at `mouseup` (template binding) and only
        // when the highlight set actually changes view-bound state.
        private readonly _ngZone: NgZone,
    ) {}

    // #region View-by — public state (bound from menu builders)

    /**
     * Which "view-by" mode is currently active.  Defaults to MEDIUM
     * (matches the prior `isMediumIcon = true` initial state).  Read
     * by the desktop's View submenu builder to render the active-tick.
     *
     * §1.3: collapsed from a 1-of-3 boolean cluster
     * (`isLargeIcon` / `isMediumIcon` / `isSmallIcon`) into a single
     * enum-typed field — makes the invariant "exactly one is selected"
     * unrepresentable-as-wrong instead of just convention.
     */
    iconSize: IconsSizes = IconsSizes.MEDIUM_ICONS;

    // #endregion

    // #region Sort-by — public state (bound from menu builders)

    /**
     * Which "sort-by" mode is currently active, or `null` when no sort
     * has been applied yet.  Defaults to `null` so the Sort By submenu
     * shows no active-tick on first paint — matches the prior
     * all-booleans-false initial state.
     *
     * §1.3: collapsed from a 1-of-4 boolean cluster
     * (`isSortByName` / `isSortBySize` / `isSortByItemType` /
     * `isSortByDateModified`) into a single enum-typed field.  The
     * `| null` keeps the "no selection yet" state expressible without
     * polluting the shared `SortBys` enum with a `NONE` sentinel.
     */
    sortBy: SortBys | null = null;

    // #endregion

    // #region Alignment / visibility — public state

    /**
     * `autoAlignIcons` snaps moved icons back to the grid; toggling it
     * ON triggers a one-shot realign of any previously-displaced icons.
     * `autoArrangeIcons` clears any in-memory (x,y) overrides so icons
     * flow in their default order; toggling it ON triggers a soft
     * refresh.
     */
    autoAlignIcons = true;
    autoArrangeIcons = true;

    /**
     * `showDesktopIcons` drives the View submenu's "Show desktop icons"
     * toggle. When false, the `btnStyle` is forced to `display:none` so
     * the whole grid is hidden without unmounting it.
     */
    showDesktopIcons = true;

    // #endregion

    // #region Style bindings (bound from template)

    /** Inline style for the icon `<img>` (size in px). */
    iconSizeStyle: Record<string, unknown> = {};
    /** Inline style for the shortcut overlay `<img>` (size in px). */
    shortCutIconSizeStyle: Record<string, unknown> = {};
    /** Inline style for the icon caption `<p>` (font size). */
    figCapIconSizeStyle: Record<string, unknown> = {};
    /** Inline style for the per-icon container `<button>`. */
    btnStyle: Record<string, unknown> = {};

    // #endregion

    // #region Grid sizing — constants + current

    /** Allowed grid sizes (px) corresponding to small / medium / large. */
    readonly MIN_GRID_SIZE = 70;
    readonly MID_GRID_SIZE = 90;
    readonly MAX_GRID_SIZE = 120;

    /**
     * Currently-active grid column size. Defaults to MID (the medium
     * view mode is `isMediumIcon = true` on init).
     */
    GRID_SIZE = this.MID_GRID_SIZE;

    /**
     * Vertical gap between icon rows (px). Constant for now; could
     * become configurable per-view-mode later if the design calls for
     * it.
     */
    ROW_GAP = 25;

    // #endregion

    // #region Cross-cut wiring (component-supplied callbacks)

    /**
     * Default no-op shims so the handler is safe to call before
     * `init()` runs (e.g. unit tests). DesktopComponent's `ngOnInit`
     * supplies the real implementations before any user interaction
     * can reach the handler.
     */
    private _callbacks: DesktopIconsHandlerInit = {
        refresh: async () => { /* set via init() */ },
        sortIcons: () => { /* set via init() */ },
        rebuildDesktopMenu: () => { /* set via init() */ },
        hideDesktopContextMenuAndOthers: () => { /* set via init() */ },
        isFormDirty: () => { /* set via init() */ },
        getIsRenameActive: () => false, 
        removeWindowFocus: () => { /* set via init() */ },
        getIsWindowDragActive: () => false,
        getIsStartMenuOpen: () => false,
        clearDragAndDropFile: () => { /* set via init() */ },
        getUniqueId: () => Constants.EMPTY_STRING,
        getFiles: () => [],
        // Keyboard-navigation triggers — wired by the component in init()
        // to forward to iconFileOps (`onRenameFileTxtBoxShow`, `onDelete`)
        // and to the component's `runApplication`. No-op defaults so the
        // handler is safe to call pre-init().
        onTriggerOpenForId: () => { /* set via init() */ },
        onTriggerRenameForId: () => { /* set via init() */ },
        onTriggerDeleteForId: () => { /* set via init() */ },
        // §1.4 placeholder — replaced by real `@ViewChild` ElementRefs in init().
        // The non-null assertions are safe because every public method that
        // dereferences `elements.X` is only ever invoked AFTER the component
        // has called `init()` in its `ngOnInit`.
        elements: {
            vantaCntnr: null!,
            desktopIconOl: null!,
            desktopIconCloneCntnr: null!,
            multiSelectPane: null!,
            invalidCharsToolTip: null!,
        },
    };

    /**
     * Wire the cross-cut callbacks (see `DesktopIconsHandlerInit`
     * docstring). Must be called once during `DesktopComponent.ngOnInit`
     * BEFORE the first call to `getDesktopMenuData()` so the rebuild
     * callback is in place.
     */
    init(callbacks: DesktopIconsHandlerInit): void {
        this._callbacks = callbacks;
    }

    // #endregion

    // #region View-by — public methods (menu actions)

    viewByLargeIcon(): void { this.viewBy(IconsSizes.LARGE_ICONS); }
    viewByMediumIcon(): void { this.viewBy(IconsSizes.MEDIUM_ICONS); }
    viewBySmallIcon(): void { this.viewBy(IconsSizes.SMALL_ICONS); }

    /**
     * Apply a view-by mode.  §1.3: replaces the original three-way
     * sequential-`if` + `setViewBy(b,b,b)` mutation with a single
     * enum assignment.  The downstream style + grid + menu-rebuild
     * trio still runs unconditionally, preserving the original
     * behaviour for any caller that passes an unrecognised value
     * (the assignment is a no-op against the existing value in that
     * case, since `IconsSizes` is closed).
     */
    viewBy(viewBy: IconsSizes): void {
        this.iconSize = viewBy;

        this.changeIconsSize(viewBy);
        this.changeGridRowColSize();
        this._callbacks.rebuildDesktopMenu();
    }

    // #endregion

    // #region Sort-by — public methods (menu actions)

    sortByNameM(): void { this.applySortBy(SortBys.NAME); }
    sortBySizeM(): void { this.applySortBy(SortBys.SIZE); }
    sortByItemTypeM(): void { this.applySortBy(SortBys.ITEM_TYPE); }
    sortByDateModifiedM(): void { this.applySortBy(SortBys.DATE_MODIFIED); }

    /**
     * Apply a sort-by mode.  §1.3: replaces the original four-way
     * sequential-`if` + `setSortBy(b,b,b,b)` mutation with a single
     * enum assignment.  Delegates the actual list mutation to the
     * component (via the `sortIcons` callback) because the icon
     * list lives on `DesktopIconFileOpsHandler` (§1.1.4.5) and the
     * sort orchestration stays component-side.
     *
     * Renamed from `sortBy(value)` to free up the `sortBy` field name.
     */
    applySortBy(sortBy: SortBys): void {
        this.sortBy = sortBy;

        this._callbacks.sortIcons(sortBy);
        this._callbacks.rebuildDesktopMenu();
    }

    // #endregion

    // #region Auto-arrange / auto-align

    /**
     * Toggle `autoArrangeIcons`. When turning ON, drop any per-icon
     * inline positioning so every `<li>` reflows at its natural
     * `*ngFor` (array-order) position.
     *
     * Preserved behaviour: the cleanup fires ONLY on the off-to-on
     * edge — toggling off does nothing besides flipping the flag (the
     * existing positions remain).
     *
     * §3-followup — REPLACED the previously-paired `refresh(false)`
     * soft-refresh call with an explicit inline-style strip across all
     * desktop icon `<li>`s.
     *
     * The old soft-refresh (clear `files` → wait 25ms → re-push) used
     * to incidentally achieve "reflow to default order" because pre-
     * §3.B Angular tore down every `<li>` on `files = []` and rebuilt
     * fresh empty-style nodes on re-push.  Post-§3.B trackBy (keyed
     * on `${path}|${name}`) keeps the same DOM nodes across that
     * round-trip, so the inline `transform` / `gridColumn` / `gridRow`
     * the drag handlers wrote SURVIVE the refresh — and "Auto arrange
     * icons" would silently do nothing.  We now strip those styles
     * directly, which both restores the original behaviour and skips
     * the unnecessary 25ms array-thrash.
     */
    async autoArrangeIcon(): Promise<void> {
        this.autoArrangeIcons = !this.autoArrangeIcons;
        if (this.autoArrangeIcons) {
            // §1.4 — pass the icon-grid ElementRef.nativeElement.
            const ol = this._callbacks.elements.desktopIconOl?.nativeElement;
            if (ol) {
                // Mirror the exact set of properties the drag handlers
                // can write (see `handleMoveBtnIconsToNewPositionAlignOff`
                // and `...AlignOn` in `desktop.icon.alignment.helper.ts`).
                const lis = ol.querySelectorAll<HTMLElement>('li[id^="desktopIcon_li"]');
                lis.forEach(li => {
                    li.style.removeProperty('position');
                    li.style.removeProperty('transform');
                    li.style.removeProperty('--grid-col');
                    li.style.removeProperty('--grid-row');
                    li.style.removeProperty('grid-column');
                    li.style.removeProperty('grid-row');
                });
            }
            // Wipe the tracking list — these icons no longer have manual
            // positions, so a subsequent "Align icons to grid" has
            // nothing to snap (matches the pre-trackBy outcome, where
            // re-pushed `<li>` ids no longer matched the old entries).
            this.movedBtnIds = [];
        }
        this._callbacks.rebuildDesktopMenu();
    }

    /**
     * Toggle `autoAlignIcons`. When turning ON, snap any previously-
     * displaced icons (tracked in `movedBtnIds`) back to the nearest
     * grid cell via `DesktopIconAlignmentHelper.correctMisalignedIcons`
     * — which writes a snapped `translate(x, y)` inline transform on
     * each icon's `<li>` in place.
     *
     * Preserved behaviour: same off-to-on edge guard as
     * `autoArrangeIcon`.
     *
     * §3-followup — DROPPED the previously-paired `refresh(false)`
     * soft-refresh call.  That call tore down every `<li>` (clear
     * `files`) and rebuilt them (re-push 25ms later), which:
     *   1. WIPED the inline transforms `correctMisalignedIcons` had
     *      just written, AND
     *   2. laid every icon out at its natural `*ngFor` array-order
     *      position, regardless of where the user had placed it.
     * Net effect: the menu item "Align icons to grid" silently
     * REORDERED every icon instead of snapping each moved icon to
     * its nearest cell.  That refresh shape belongs to "Auto arrange
     * icons" (`autoArrangeIcon` above), whose stated purpose IS to
     * discard manual positions and reflow.
     *
     * §1.1.4.3: `movedBtnIds` migrated to this handler, so the
     * previous `correctMisalignedIcons` cross-cut callback was retired
     * — the helper is now invoked directly.
     */
    async autoAlignIcon(): Promise<void> {
        this.autoAlignIcons = !this.autoAlignIcons;
        if (this.autoAlignIcons) {
            // §1.4 — pass the icon-grid ElementRef.nativeElement.
            DesktopIconAlignmentHelper.correctMisalignedIcons(
                this.movedBtnIds,
                this.GRID_SIZE,
                this.ROW_GAP,
                this._callbacks.elements.desktopIconOl.nativeElement,
            );
        }
        this._callbacks.rebuildDesktopMenu();
    }

    // #endregion

    // #region Icon visibility

    /**
     * Hide the icon grid by forcing `display:none` on every icon
     * container. The icons remain mounted (so their state is
     * preserved); only the visual is gone. Triggers a menu rebuild so
     * the View submenu's "Show desktop icons" toggle reflects the new
     * state.
     */
    hideDesktopIcon(): void {
        this.showDesktopIcons = false;
        this.btnStyle = { 'display': 'none' };
        this._callbacks.rebuildDesktopMenu();
    }

    /** Re-show the icon grid. Mirror of `hideDesktopIcon`. */
    showDesktopIcon(): void {
        this.showDesktopIcons = true;
        this.btnStyle = { 'display': 'block' };
        this._callbacks.rebuildDesktopMenu();
    }

    // #endregion

    // #region Sizing — public methods

    /**
     * Resolve the icon-size and grid styles for the given view mode.
     * The actual style math lives in `DesktopStyleHelper`; the handler
     * just owns the resulting style records and exposes them to the
     * template.
     *
     * §1.5 — parameter tightened from `string` to `IconsSizes`.  Both
     * call sites (`viewBy()` and the explicit-restore path) pass an
     * `IconsSizes` member, and the downstream helper now accepts the
     * same enum.
     */
    changeIconsSize(iconSize: IconsSizes): void {
        const result = DesktopStyleHelper.handleChangeIconsSize(
            iconSize,
            this.GRID_SIZE,
            this.MIN_GRID_SIZE,
            this.MID_GRID_SIZE,
            this.MAX_GRID_SIZE,
        );

        this.iconSizeStyle = result[0];
        this.shortCutIconSizeStyle = result[1];
        this.figCapIconSizeStyle = result[2];
    }

    /**
     * Resolve the per-icon container style (grid row/col sizes). Kept
     * separate from `changeIconsSize` because `hideDesktopIcon` /
     * `showDesktopIcon` overwrite `btnStyle` directly without touching
     * the icon-size styles.
     */
    changeGridRowColSize(): void {
        // §1.4 — pass the icon-grid ElementRef.nativeElement so the
        // helper doesn't have to `document.getElementById('desktopIcon_ol')`.
        const result = DesktopStyleHelper.handleChangeGridRowColSize(
            this.GRID_SIZE,
            this.ROW_GAP,
            this.MIN_GRID_SIZE,
            this.MID_GRID_SIZE,
            this.MAX_GRID_SIZE,
            this._callbacks.elements.desktopIconOl.nativeElement,
        );
        this.btnStyle = result;
    }

    // #endregion

    // #region Selection — public state (§1.1.4.2)

    /**
     * The "isDesktopTheCaller" flag passed into
     * `hideDesktopContextMenuAndOthers`. The component's value is
     * literally `true` and never reassigned, so the handler hard-codes
     * it. Kept as a named constant so the menu-closing call sites stay
     * intent-revealing.
     */
    private static readonly IS_DESKTOP_THE_CALLER = true;

    /** Overlay chrome that is a DOM child of the desktop root but is not the desktop surface. */
    private static readonly OVERLAY_CHROME_SELECTOR = 'cos-taskbar';

    /**
     * `currIconId` is the id of the icon that received the most recent
     * click (or -1 when no icon is selected). `prevIconId` lags one
     * click behind so we can clear the previous icon's selection style
     * when focus shifts. Component code still reads `currIconId` from
     * the rename / drag / file-ops methods that haven't been extracted
     * yet — keep it PUBLIC until §1.1.4.5 collapses those last
     * dependencies.
     */
    currIconId = -1;
    private prevIconId = -1;

    /**
     * Click-event bookkeeping. `isIconBtnClickEvt` flips to true on any
     * icon click and back to false on `resetIconBtnClick` /
     * `btnStyleAndValuesReset`. `iconBtnClickCnt` counts clicks within
     * the current selection burst — `handleIconHighLightState` uses it
     * to detect "clicked an icon, then clicked the desktop empty space"
     * sequences. Both are private — only handler internals branch on
     * them.
     */
    private isIconBtnClickEvt = false;
    private iconBtnClickCnt = 0;

    /**
     * `isIconInFocusDueToPriorAction` is true when the selection
     * highlight was set NOT by a fresh click but by a prior action
     * (e.g. completing a rename leaves the renamed icon highlighted).
     * `handleIconHighLightState` honors it to avoid clearing a
     * legitimately-restored highlight. Public because `refresh()` (on
     * component, §1.1.4.5) and the rename methods (§1.1.4.5) write it.
     */
    isIconInFocusDueToPriorAction = false;

    /**
     * IDs of all icons currently in the multi-select highlight set
     * (string-typed because the DOM attribute is string-typed). Public
     * because drag (§1.1.4.3) and delete (§1.1.4.5) read it.
     */
    markedBtnIds: string[] = [];

    /**
     * `isMultiSelectActive` is true while the lasso rectangle is
     * being dragged. Private — selection internals only.
     *
     * Historical note: this used to be paired with an
     * `isMultiSelectEnabled` latch that was flipped false on every
     * icon `mouseenter` and back to true on `mouseleave`, with
     * `activateMultiSelect` gated on it. That latch was a chronic
     * source of "lasso silently refuses to start" bugs because
     * `mouseleave` is unreliable: HTML5 native drag suppresses
     * mouseleave on the drag source between `dragstart` and
     * `dragend`, fast pointer travel can skip it, and Angular
     * rerenders mid-hover can tear the icon down before it fires.
     * Compounding the problem, `DesktopComponent` is never destroyed
     * (see `/memories/repo/cheetahos-desktop-lifecycle.md`), so a
     * single missed mouseleave trapped the latch at false until the
     * tab was reloaded. The latch is gone — `activateMultiSelect`
     * now uses a stateless DOM-target test (mousedown landed on the
     * OL itself, not bubbled up from an icon) which can never go
     * stale.
     */
    private isMultiSelectActive = false;

    /**
     * True once at least one icon has been multi-select-highlighted.
     * Public because delete (§1.1.4.5) and drag (§1.1.4.3) branch on
     * it to decide between "operate on the selection" vs "operate on
     * the single hovered icon".
     */
    areMultipleIconsHighlighted = false;

    /**
     * DOM handle to the lasso rectangle element + the starting mouse
     * position when the lasso drag began. Both are reset to null when
     * the drag ends. Private — only used by activate / deactivate /
     * update lifecycle.
     */
    private multiSelectElmnt: HTMLDivElement | null = null;
    private multiSelectStartingPosition: MouseEvent | null = null;

    /**
     * §3.A — cached lasso state.  `_lassoMousemoveListener` is the
     * function reference we register on the icon `<ol>` at lasso-start
     * (outside Angular's zone) and remove at lasso-end; storing it as
     * a field is what makes `removeEventListener` matching work.
     * `_cachedDesktopBtns` is the `.desktopIcon-btn` NodeList captured
     * once at lasso-start — replaces what was a `querySelectorAll` on
     * every pixel of mouse movement inside `highlightSelectedItems`.
     * Both reset to null/[] at lasso-end so the GC can collect.
     */
    private _lassoMousemoveListener: ((e: MouseEvent) => void) | null = null;
    private _cachedDesktopBtns: readonly HTMLElement[] = [];

    /**
     * Counts background clicks AFTER a multi-select set is present.
     * `handleIconHighLightState` uses it to require TWO desktop clicks
     * to dismiss a multi-select (first click does nothing visible so
     * users don't accidentally lose their selection by missing an
     * icon). Private — selection internals only.
     */
    private desktopClickCounter = 0;

    // #endregion

    // #region Selection — public methods (§1.1.4.2)

    /**
     * Fired by the per-icon button (click). Routes through
     * `executeIconClickTasks` to update selection state, then paints
     * the click-style on the just-clicked icon.
     */
    onDesktopIconClick(evt: MouseEvent, id: number): void {
        evt.preventDefault();
        evt.stopPropagation();
        // Clicking a desktop icon deactivates the focused window's title bar,
        // same as clicking empty desktop space (this click is stopPropagation'd
        // here, so it never reaches the desktop root's handleIconHighLightState).
        this._callbacks.removeWindowFocus();
        this.executeIconClickTasks(id);
        DesktopStyleHelper.setBtnStyle(id, true, this.currIconId, this.isIconInFocusDueToPriorAction);
    }

    /**
     * Fired by the per-icon button (mousedown). If a multi-select set
     * is already painted and the user mouse-downs on an icon that's
     * NOT part of that set, the set is cleared so the next click
     * starts a fresh single selection.
     */
    onMouseDown(_evt: MouseEvent, i: number): void {
        if (this.areMultipleIconsHighlighted && !this.markedBtnIds.includes(String(i))) {
            this.clearStates();
        }
    }

    /**
     * Fired by the per-icon button (mouseenter). When NOT in a lasso
     * drag, paints the hover-style on the icon and pre-clones it for
     * the drag-image cache (so dragging starts instantly without a
     * clone-on-grab delay).
     *
     * (Previously also flipped a `isMultiSelectEnabled` latch to
     * false to suppress lasso start while hovering an icon. That
     * latch is gone — `activateMultiSelect` now decides from
     * `evt.target` directly, which is robust to missed mouseleave.)
     */
    onMouseEnter(id: number): void {
        if (!this.isMultiSelectActive) {
            DesktopIconAlignmentHelper.preCloneDesktopIcon(id);
            DesktopStyleHelper.setBtnStyle(id, true, this.currIconId, this.isIconInFocusDueToPriorAction);
        }
    }

    /**
     * Fired by the per-icon button (mouseleave). When NOT in a lasso
     * drag and NOT leaving the currently-selected icon, clears the
     * hover-style and discards the pre-clone — unless the icon is in
     * the multi-select set, in which case the selection styling is
     * preserved.
     *
     * Special case: leaving the currently-selected icon (and no prior
     * action is keeping it focused) downgrades its highlight from
     * "selected" to a softer style.
     */
    onMouseLeave(id: number): void {
        if (!this.isMultiSelectActive) {
            if (id !== this.currIconId) {
                if (this.markedBtnIds.includes(String(id))) {
                    return;
                } else {
                    DesktopStyleHelper.removeBtnStyle(id);
                    DesktopIconAlignmentHelper.clearPreClonedIconById(id);
                }
            }
            else if ((id === this.currIconId) && !this.isIconInFocusDueToPriorAction) {
                DesktopStyleHelper.setBtnStyle(id, false, this.currIconId, this.isIconInFocusDueToPriorAction);
            }
        }
    }

    /**
     * Wholesale reset of single-icon selection state. Called from
     * `resetIconBtnsAndContextMenus` (component) and from
     * `handleIconHighLightState`. Does NOT touch the multi-select
     * set — that's `clearStates()`.
     */
    btnStyleAndValuesReset(): void {
        this.isIconBtnClickEvt = false;
        this.iconBtnClickCnt = 0;
        this.removeIdFromMarked(this.currIconId);
        DesktopStyleHelper.removeBtnStyle(this.currIconId);
        DesktopStyleHelper.removeBtnStyle(this.prevIconId);
        this.currIconId = -1;
        this.prevIconId = -1;
        // (`iconBtnClickCnt = 0` is set a second time at this point in
        // the original — duplicate write, preserved verbatim to avoid
        // behavioural drift.)
        this.iconBtnClickCnt = 0;
        this.isIconInFocusDueToPriorAction = false;
    }

    /**
     * Remove a single id from the multi-select set and drop its
     * pre-clone. Used by `btnStyleAndValuesReset` and by the future
     * file-ops handler (§1.1.4.5).
     *
     * §3.E — was a 2-pass operation: `findIndex` to locate, then
     * `filter((_, i) => i !== idx)` to remove.  Now ONE pass: a
     * `filter(x => x !== target)` that performs the comparison
     * directly.  `clearPreClonedIconById` is a no-op when the id
     * isn't tracked, so calling it unconditionally is safe even if
     * the id wasn't in `markedBtnIds` to begin with.
     */
    removeIdFromMarked(id: number): void {
        const target = String(id);
        this.markedBtnIds = this.markedBtnIds.filter(x => x !== target);
        DesktopIconAlignmentHelper.clearPreClonedIconById(id);
    }

    /**
     * Count of DOM elements currently styled as multi-select-highlight.
     * Used by `deActivateMultiSelect` (lasso end) and by the drag
     * source handlers (§1.1.4.3) to know whether to operate on the
     * lasso set vs the single dragged icon.
     */
    getCountOfAllTheMarkedButtons(): number {
        const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
        return btnIcons.length;
    }

    /**
     * Walk every DOM element styled as multi-select-highlight and add
     * its id to `markedBtnIds` (and pre-clone it for drag). Called once
     * at lasso-end after the highlight class has been applied to all
     * intersected icons by the lasso-update pass.
     */
    getIDsOfAllTheMarkedButtons(): void {
        const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
        btnIcons.forEach(btnIcon => {
            const btnId = btnIcon.id.replace('iconBtn', Constants.EMPTY_STRING);
            if (!this.markedBtnIds.includes(btnId)) {
                this.markedBtnIds.push(btnId);
                DesktopIconAlignmentHelper.preCloneDesktopIcon(Number(btnId));
            }
        });
    }

    /**
     * Walk every currently-marked icon id and clear both its visible
     * selection styling AND its entry in the drag-clone tracking
     * arrays.
     *
     * Note (preserved from §2.x bug-fix sweep): the previous
     * implementation gated the cleanup on an `iconBtn${id}` DOM
     * lookup, which was harmful — `clearPreClonedIconById` is pure
     * in-memory array maintenance and missing it would leak stale
     * clone-tracking entries into the next drag. Both helpers are
     * self-guarding; call unconditionally.
     */
    removeClassAndStyleFromBtn(): void {
        this.markedBtnIds.forEach(id => {
            const numericId = Number(id);
            DesktopStyleHelper.removeBtnStyle(numericId);
            DesktopIconAlignmentHelper.clearPreClonedIconById(numericId);
        });
    }

    /**
     * Shared selection-update routine for both `onDesktopIconClick`
     * (left-click) and `onShowDesktopIconCntxtMenu` (right-click).
     * Updates curr/prev ids, increments the click counter, closes any
     * other open desktop menus, adds the icon to the multi-select set
     * if not already there, and clears the previous icon's
     * selection-style if it changed.
     */
    executeIconClickTasks(id: number): void {
        this.prevIconId = this.currIconId;
        this.currIconId = id;
        this.isIconBtnClickEvt = true;
        this.iconBtnClickCnt++;
        this._callbacks.hideDesktopContextMenuAndOthers(DesktopIconsHandler.IS_DESKTOP_THE_CALLER);

        if (!this.markedBtnIds.includes(String(id)))
            this.markedBtnIds.push(String(id));

        if (this.prevIconId !== id) {
            DesktopStyleHelper.removeBtnStyle(this.prevIconId);
            // (Intentionally NOT calling clearPreClonedIconById here —
            // preserved comment from the original: "this being commented
            // out, is totally fine".)
        }
    }

    /**
     * Reset just the click-event bookkeeping without disturbing the
     * selection itself. Used as a half-reset by the rename flow.
     */
    resetIconBtnClick(): void {
        this.isIconBtnClickEvt = false;
        this.iconBtnClickCnt = 0;
    }

    /**
     * Click handler fired on the desktop root (NOT on an icon).
     * Decides what to do based on multi-select state + whether a
     * rename is in progress.
     *
     * Branches preserved verbatim from the original implementation —
     * the behaviour is intentionally subtle: requires TWO clicks to
     * dismiss a multi-select set (so missing an icon by a few pixels
     * doesn't wipe the selection), and threads rename commit/abort
     * through `isFormDirty` for the "click-away" case (1a).
     */
    handleIconHighLightState(evt?: MouseEvent): void {
        this._callbacks.hideDesktopContextMenuAndOthers(DesktopIconsHandler.IS_DESKTOP_THE_CALLER);

        // The taskbar is nested inside the desktop root, so its clicks bubble here.
        // It decides for itself whether a click should deactivate the focused window
        // (see TaskBarComponent.onTaskBarClick); re-deciding here would undo a
        // taskbar entry's restore-and-focus in the same click.
        const target = evt?.target as HTMLElement | null;
        if (!target?.closest(DesktopIconsHandler.OVERLAY_CHROME_SELECTOR))
            this._callbacks.removeWindowFocus();

        if (!this._callbacks.getIsRenameActive()) {
            this.btnStyleAndValuesReset();

            if (this.areMultipleIconsHighlighted && this.desktopClickCounter === 0) {
                this.desktopClickCounter++;
                return;
            }

            if (this.areMultipleIconsHighlighted && this.desktopClickCounter === 1) {
                this.clearStates();
            }
        }

        if (this._callbacks.getIsRenameActive()) {
            if ((this.isIconBtnClickEvt && this.iconBtnClickCnt >= 1)) {
                //case 1a - was only clicking on the desktop icons, initiated a
                //         rename, then clicked on the desktop empty space
                if (this._callbacks.getIsRenameActive())
                    this._callbacks.isFormDirty();

                if (!this._callbacks.getIsRenameActive())
                    this.resetIconBtnClick();
            }

            if (this.isIconInFocusDueToPriorAction) {
                DesktopStyleHelper.setBtnStyle(this.currIconId, false, this.currIconId, this.isIconInFocusDueToPriorAction);
                this.isIconInFocusDueToPriorAction = false;
                return;
            }
        }
    }

    /**
     * Wholesale dismiss of the multi-select set. Clears the in-memory
     * id list, the visible highlight styling, the file-service drag
     * staging, and the "first click does nothing" counter.
     */
    clearStates(): void {
        this.areMultipleIconsHighlighted = false;
        this._callbacks.clearDragAndDropFile();
        this.removeClassAndStyleFromBtn();
        this.desktopClickCounter = 0;
        this.markedBtnIds = [];
    }

    /**
     * Begin a lasso multi-select drag from the desktop root
     * (mousedown). Suppressed while a window-drag is in progress (so
     * dragging a window doesn't accidentally start a lasso).
     *
     * §3.A — also caches the `.desktopIcon-btn` NodeList (queried ONCE
     * here instead of on every mousemove pixel inside the lasso loop)
     * and registers the `mousemove` listener imperatively, OUTSIDE
     * Angular's zone, so per-pixel hit-testing does not trigger a
     * change-detection cycle.  The template no longer carries the
     * `(mousemove)` binding for the lasso.
     */
    activateMultiSelect(evt: MouseEvent): void {
        if (this._callbacks.getIsWindowDragActive()) return;

        // Stateless gate: a lasso may only START when the mousedown
        // landed on empty desktop space — i.e., directly on the OL
        // (or on an LI gap), NOT bubbled up from inside an icon
        // button. This replaces a prior `isMultiSelectEnabled` latch
        // that was flipped via per-icon mouseenter/mouseleave; that
        // latch silently trapped at `false` whenever mouseleave was
        // skipped (HTML5 drag suppresses it on the drag source, fast
        // pointer travel can miss it, Angular rerenders mid-hover can
        // tear the icon down before it fires) and — because
        // DesktopComponent is never destroyed — the stuck state then
        // persisted until full page reload. `closest('.desktopIcon-btn')`
        // walks up from the actual click target, so it correctly
        // detects a click on any descendant of the icon (img, p, div).
        const target = evt.target as HTMLElement | null;
        const startedOnIcon = !!(target && target.closest && target.closest('.desktopIcon-btn'));
        if (startedOnIcon) return;

        this.isMultiSelectActive = true;
        // §1.4 — was `document.getElementById('dskTopMultiSelectPane')`.
        this.multiSelectElmnt = this._callbacks.elements.multiSelectPane.nativeElement as HTMLDivElement;
        this.multiSelectStartingPosition = evt;

        // §3.A — cache the icon list once per lasso.  Adding or
        // removing icons mid-lasso isn't possible (the user is
        // mid-drag with the mouse), so a snapshot is safe.
        const ol = this._callbacks.elements.desktopIconOl.nativeElement;
        this._cachedDesktopBtns = Array.from(
            ol.querySelectorAll<HTMLElement>('.desktopIcon-btn')
        );

        // §3.A — attach the lasso mousemove listener outside the
        // Angular zone.  Bound via `.bind` so `removeEventListener`
        // in `deActivateMultiSelect` matches the exact reference.
        this._lassoMousemoveListener = this.updateDivWithAndSize.bind(this);
        this._ngZone.runOutsideAngular(() => {
            ol.addEventListener(
                'mousemove',
                this._lassoMousemoveListener as EventListener,
            );
        });
    }

    /**
     * End a lasso multi-select drag (mouseup). Hides the lasso
     * rectangle, clears the in-progress state, and — if any icons
     * were intersected — finalises the highlight set into
     * `markedBtnIds` via `finalizeLassoSelection`.
     *
     * §3.A — also detaches the outside-zone mousemove listener and
     * releases the cached icon NodeList so subsequent navigation /
     * deletion can not stale-reference removed nodes.
     * §3.D — collapsed the previous two back-to-back
     * `querySelectorAll('.desktopIcon-multi-select-highlight')`
     * (count, then enumerate) into ONE walk in
     * `finalizeLassoSelection`.
     */
    deActivateMultiSelect(): void {
        if (this.multiSelectElmnt) {
            DesktopStyleHelper.setDivWithAndSize(this.multiSelectElmnt, 0, 0, 0, 0, false);
        }

        // §3.A — detach the outside-zone mousemove listener BEFORE we
        // null out the cached btn list, so any in-flight event is
        // still serviced safely.
        if (this._lassoMousemoveListener) {
            const ol = this._callbacks.elements.desktopIconOl.nativeElement;
            ol.removeEventListener(
                'mousemove',
                this._lassoMousemoveListener as EventListener,
            );
            this._lassoMousemoveListener = null;
        }
        this._cachedDesktopBtns = [];

        this.multiSelectElmnt = null;
        this.multiSelectStartingPosition = null;
        this.isMultiSelectActive = false;

        // §3.D — single DOM walk that returns count + populates ids.
        this.finalizeLassoSelection();
    }

    /**
     * §3.D — single-walk replacement for the previous
     * `getCountOfAllTheMarkedButtons()` + `getIDsOfAllTheMarkedButtons()`
     * pair (two back-to-back `querySelectorAll` calls on the same
     * selector).  Called from `deActivateMultiSelect` only.
     */
    private finalizeLassoSelection(): void {
        const btnIcons = document.querySelectorAll('.desktopIcon-multi-select-highlight');
        if (btnIcons.length === 0) {
            this.areMultipleIconsHighlighted = false;
            return;
        }
        this.areMultipleIconsHighlighted = true;
        btnIcons.forEach(btnIcon => {
            const btnId = btnIcon.id.replace('iconBtn', Constants.EMPTY_STRING);
            if (!this.markedBtnIds.includes(btnId)) {
                this.markedBtnIds.push(btnId);
                DesktopIconAlignmentHelper.preCloneDesktopIcon(Number(btnId));
            }
        });
    }

    /**
     * During a lasso drag (mousemove): recompute the rectangle's
     * top-left + size from the start and current mouse positions,
     * resize the visible lasso element, and ask the style helper to
     * re-highlight any icons currently intersected by the rectangle.
     *
     * §3.A — registered imperatively (NOT via template binding) in
     * `activateMultiSelect` so it runs OUTSIDE Angular's zone.  The
     * cached `_cachedDesktopBtns` list is passed to the highlighter
     * so the per-pixel call no longer does its own `querySelectorAll`.
     * Public so external callers (and tests) can still drive it; the
     * `multiSelectStartingPosition` / `multiSelectElmnt` null-guards
     * make it a no-op if the lasso isn't active.
     */
    updateDivWithAndSize(evt: MouseEvent): void {
        if (this.multiSelectStartingPosition && this.multiSelectElmnt) {
            const startingXPoint = this.multiSelectStartingPosition.clientX;
            const startingYPoint = this.multiSelectStartingPosition.clientY;

            const currentXPoint = evt.clientX;
            const currentYPoint = evt.clientY;

            const startX = Math.min(startingXPoint, currentXPoint);
            const startY = Math.min(startingYPoint, currentYPoint);
            const divWidth = Math.abs(startingXPoint - currentXPoint);
            const divHeight = Math.abs(startingYPoint - currentYPoint);

            DesktopStyleHelper.setDivWithAndSize(this.multiSelectElmnt, startX, startY, divWidth, divHeight, true);

            // §3.A — pass the cached btn list so the helper does not
            // re-query the DOM on every pixel of mouse movement.
            DesktopStyleHelper.highlightSelectedItems(
                startX, startY, divWidth, divHeight, this._cachedDesktopBtns,
            );
        }
    }

    // #region Keyboard navigation
    //
    // Bound from the icon-grid `<ol>` via `(keydown)` so it only fires
    // when focus is inside the desktop (the OL itself or one of the
    // icon buttons — both have `tabindex="0"`). Open-window keystrokes
    // therefore never reach this handler.
    //
    // Supported keys:
    //   ArrowUp / Down / Left / Right — spatial neighbour selection.
    //                                   Uses `getBoundingClientRect()`
    //                                   instead of index arithmetic so
    //                                   it works regardless of the
    //                                   grid's auto-flow direction,
    //                                   gaps, or free-positioned icons.
    //   Home / End                    — first / last icon in the list.
    //   Enter                         — run the focused icon's app.
    //   F2                            — start in-place rename.
    //   Delete                        — recycle-or-delete (honours the
    //                                   existing single-vs-multi-select
    //                                   branching inside `onDelete`).
    //   Escape                        — clear selection.
    //   Ctrl/Cmd + A                  — select every icon.
    //   Printable [a-z0-9]            — type-ahead: jump to next icon
    //                                   whose name starts with the
    //                                   typed character (cyclic from
    //                                   the current selection).
    //
    // Anything else (Tab, modified keys we don't claim, OS shortcuts)
    // is left to the browser / OS so we never swallow combos like
    // Ctrl+R reload, Ctrl+Shift+V clipboard, etc.

    /**
     * Type-ahead state. `_typeAheadBuffer` is reserved for a future
     * multi-character sticky buffer (Windows-style: type "do" → jump
     * to first icon starting with "do"). For now we only key on the
     * single most recent character, but the timer + buffer scaffold
     * is in place so the upgrade is a single-method change.
     */
    private static readonly KEYBOARD_TYPE_AHEAD_RESET_MS = 600;
    private _typeAheadBuffer = Constants.EMPTY_STRING;
    private _typeAheadTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * Main keyboard dispatcher. Bound from the OL's `(keydown)` in
     * the template.
     *
     * Bails when:
     *   - rename is active (the textarea owns its own keys),
     *   - the event originates from an editable element (defence
     *     against the textarea / future inline inputs not being
     *     stopPropagation'd at their source),
     *   - the icon list is empty (nothing to navigate to).
     */
    onDesktopKeyDown(evt: KeyboardEvent): void {
        // Stand down while the start menu is open — it owns keyboard navigation
        // then, so the desktop must not also react to the same keystrokes.
        if (this._callbacks.getIsStartMenuOpen()) return;

        // Rename owns the keys when active — the rename textarea
        // (Enter / Escape / printable typing) must reach the form.
        if (this._callbacks.getIsRenameActive()) return;

        // Defensive: even outside rename, refuse to act if the event
        // is coming from an editable element. This catches future
        // surfaces (search box, file-explorer inline edit, etc.)
        // that might live inside the desktop OL without going through
        // the rename flag.
        const tgt = evt.target as HTMLElement | null;
        if (tgt) {
            const tag = tgt.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tgt.isContentEditable) {
                return;
            }
        }

        const files = this._callbacks.getFiles();
        if (files.length === 0) return;

        const key = evt.key;

        // Ctrl/Cmd + A — select all. Checked BEFORE the
        // "bail on other modifiers" guard so Ctrl is explicitly
        // accepted here.
        if ((evt.ctrlKey || evt.metaKey) && (key === 'a' || key === 'A') && !evt.altKey && !evt.shiftKey) {
            evt.preventDefault();
            this.selectAllIcons();
            return;
        }

        // Don't swallow any other modified key — leaves browser / OS
        // shortcuts (Ctrl+R, Ctrl+Shift+V, Alt+Tab, Cmd+Q, …) intact.
        if (evt.ctrlKey || evt.altKey || evt.metaKey) return;

        switch (key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight': {
                evt.preventDefault();
                const dir =
                    key === 'ArrowUp'   ? 'up'   :
                    key === 'ArrowDown' ? 'down' :
                    key === 'ArrowLeft' ? 'left' : 'right';
                const nextId = this.findSpatialNeighbour(dir);
                if (nextId !== null) this.selectIconAndFocus(nextId);
                return;
            }

            case 'Home':
                evt.preventDefault();
                this.selectIconAndFocus(0);
                return;

            case 'End':
                evt.preventDefault();
                this.selectIconAndFocus(files.length - 1);
                return;

            case 'Enter':
                if (this.currIconId >= 0 && this.currIconId < files.length) {
                    evt.preventDefault();
                    this._callbacks.onTriggerOpenForId(this.currIconId);
                }
                return;

            case 'F2':
                if (this.currIconId >= 0 && this.currIconId < files.length) {
                    evt.preventDefault();
                    this._callbacks.onTriggerRenameForId(this.currIconId);
                }
                return;

            case 'Delete': {
                // `onDelete` already branches internally on
                // `areMultipleIconsHighlighted` (multi-select set vs
                // single `selectedFile`). For both branches the
                // component-side bridge sets `selectedFile` from the
                // id we pass it; for the multi branch the id is just
                // a placeholder (the multi path reads `markedBtnIds`
                // not `selectedFile`).
                let id = this.currIconId;
                if (this.areMultipleIconsHighlighted && this.markedBtnIds.length > 0) {
                    // Pick the lowest-index marked id as the placeholder
                    // so the component bridge has a valid FileInfo to
                    // hand `selectedFile`.
                    id = Math.min(...this.markedBtnIds.map(s => Number(s)));
                }
                if (id >= 0 && id < files.length) {
                    evt.preventDefault();
                    this._callbacks.onTriggerDeleteForId(id);
                }
                return;
            }

            case 'Escape':
                evt.preventDefault();
                if (this.areMultipleIconsHighlighted) {
                    this.clearStates();
                }
                this.btnStyleAndValuesReset();
                return;
        }

        // Type-ahead: a single printable alphanumeric character with
        // no modifiers. Restricting to [a-zA-Z0-9] avoids stealing
        // space (which would also satisfy `key.length === 1`) and
        // punctuation that the user might be trying to insert into a
        // context-menu search or similar.
        if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
            evt.preventDefault();
            this._scheduleTypeAheadReset();
            const id = this._findNextTypeAheadMatch(key);
            if (id !== null) this.selectIconAndFocus(id);
        }
    }

    /**
     * Spatial neighbour finder used by the arrow keys.
     *
     * Strategy: project every other icon's centre onto a vector in
     * the requested direction; reject candidates that lie on the
     * wrong side; among the survivors pick the one with the smallest
     * (primary-axis distance + 2 × perpendicular distance). The
     * 2× perpendicular weighting keeps the cursor walking columns /
     * rows instead of jumping diagonally to a marginally-closer
     * neighbour.
     *
     * When no icon is currently selected, any arrow press defaults
     * to index 0 (top-left) so the user has a starting point.
     */
    private findSpatialNeighbour(direction: 'up' | 'down' | 'left' | 'right'): number | null {
        const files = this._callbacks.getFiles();
        if (files.length === 0) return null;
        if (this.currIconId < 0 || this.currIconId >= files.length) return 0;

        const currBtn = document.getElementById(`iconBtn${this.currIconId}`);
        if (!currBtn) return 0;
        const currRect = currBtn.getBoundingClientRect();
        const cx = currRect.left + currRect.width / 2;
        const cy = currRect.top  + currRect.height / 2;

        let bestId: number | null = null;
        let bestScore = Infinity;

        for (let i = 0; i < files.length; i++) {
            if (i === this.currIconId) continue;
            const btn = document.getElementById(`iconBtn${i}`);
            if (!btn) continue;
            const r = btn.getBoundingClientRect();
            // Ignore icons that aren't laid out (zero-size) — happens
            // briefly during the per-icon DOM swap after a refresh.
            if (r.width === 0 && r.height === 0) continue;

            const x  = r.left + r.width  / 2;
            const y  = r.top  + r.height / 2;
            const dx = x - cx;
            const dy = y - cy;

            // Use a small epsilon (1px) so two icons sharing exactly
            // the same row / column are not treated as "in direction".
            let inDirection = false;
            switch (direction) {
                case 'up':    inDirection = dy < -1; break;
                case 'down':  inDirection = dy >  1; break;
                case 'left':  inDirection = dx < -1; break;
                case 'right': inDirection = dx >  1; break;
            }
            if (!inDirection) continue;

            const primary   = (direction === 'up' || direction === 'down') ? Math.abs(dy) : Math.abs(dx);
            const secondary = (direction === 'up' || direction === 'down') ? Math.abs(dx) : Math.abs(dy);
            const score     = primary + secondary * 2;
            if (score < bestScore) {
                bestScore = score;
                bestId    = i;
            }
        }
        return bestId;
    }

    /**
     * Single-icon selection (for keyboard nav). Mirrors the
     * click-path bookkeeping in `onDesktopIconClick` but:
     *   1) tears down any multi-select set first (keyboard nav is
     *      single-icon by default),
     *   2) explicitly removes the prior id from `markedBtnIds`
     *      before the new id is pushed in by `executeIconClickTasks`.
     *      (`executeIconClickTasks` doesn't auto-prune the prior id
     *      — the prune normally happens later via
     *      `btnStyleAndValuesReset` on the next empty-space click.
     *      For rapid arrow navigation we need it inline to avoid
     *      `markedBtnIds` growing one entry per keystroke.)
     *   3) scrolls the new icon into view and gives it native focus
     *      so subsequent keydowns still bubble up to the OL.
     */
    private selectIconAndFocus(id: number): void {
        if (this.areMultipleIconsHighlighted) {
            this.clearStates();
        } else if (this.currIconId >= 0 && this.currIconId !== id) {
            this.removeIdFromMarked(this.currIconId);
        }

        this.executeIconClickTasks(id);
        DesktopStyleHelper.setBtnStyle(id, true, this.currIconId, this.isIconInFocusDueToPriorAction);

        const btn = document.getElementById(`iconBtn${id}`);
        if (btn) {
            // `block:'nearest'` keeps the page steady when the icon
            // is already on-screen; only scrolls when the icon would
            // otherwise be clipped.
            btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            // `preventScroll:true` because we just did the
            // scroll ourselves above — don't let .focus() also scroll
            // and double-jump the viewport.
            try { btn.focus({ preventScroll: true }); } catch { /* old browsers */ }
        }
    }

    /**
     * Ctrl/Cmd + A handler. Marks every icon and adds the
     * multi-select highlight class. Skips re-adding the class on
     * icons that already have it (lasso-then-Ctrl+A is idempotent).
     */
    private selectAllIcons(): void {
        const files = this._callbacks.getFiles();
        if (files.length === 0) return;

        // Reset first so we don't accumulate stale ids from prior
        // partial selections (`markedBtnIds.includes` then push, used
        // by the lasso path, would otherwise leave duplicates).
        this.markedBtnIds = [];

        for (let i = 0; i < files.length; i++) {
            const btn = document.getElementById(`iconBtn${i}`);
            if (btn && !btn.classList.contains('desktopIcon-multi-select-highlight')) {
                btn.classList.add('desktopIcon-multi-select-highlight');
            }
            this.markedBtnIds.push(String(i));
            DesktopIconAlignmentHelper.preCloneDesktopIcon(i);
        }
        this.areMultipleIconsHighlighted = true;
    }

    /**
     * Type-ahead lookup: find the next icon whose filename starts
     * with `ch` (case-insensitive). Search begins immediately AFTER
     * the currently-selected icon and wraps, so repeatedly pressing
     * the same letter cycles through every match.
     */
    private _findNextTypeAheadMatch(ch: string): number | null {
        const files = this._callbacks.getFiles();
        if (files.length === 0) return null;
        const lower = ch.toLowerCase();
        const start = (this.currIconId >= 0) ? this.currIconId + 1 : 0;
        for (let offset = 0; offset < files.length; offset++) {
            const idx = (start + offset) % files.length;
            const name = files[idx].getFileName ?? Constants.EMPTY_STRING;
            if (name.toLowerCase().startsWith(lower)) return idx;
        }
        return null;
    }

    /**
     * (Re)arm the inactivity timer that clears `_typeAheadBuffer`.
     * The buffer itself isn't used yet (single-char only), but the
     * timer scaffold is here so a future multi-char upgrade is a
     * one-method change.
     */
    private _scheduleTypeAheadReset(): void {
        if (this._typeAheadTimer !== null) {
            clearTimeout(this._typeAheadTimer);
        }
        this._typeAheadTimer = setTimeout(() => {
            this._typeAheadBuffer = Constants.EMPTY_STRING;
            this._typeAheadTimer = null;
        }, DesktopIconsHandler.KEYBOARD_TYPE_AHEAD_RESET_MS);
    }

    // #endregion

    // #endregion

    // #region Drag — public state (§1.1.4.3)

    /**
     * True for the duration of an icon-drag that originated on the
     * desktop. The component's `onDrop` (still here until §1.1.4.5
     * because it does heavy file-service orchestration) branches on
     * this to distinguish a desktop-internal reorder from a drop that
     * came in from the file explorer. Public for that reason.
     */
    isDragFromDesktopActive = false;

    // #endregion

    // #region Drag — private state (§1.1.4.3)

    /**
     * Index of the single icon currently being dragged (when no
     * multi-select set is active). Set by `onDragStart` via the helper
     * and consumed by `moveBtnIconsToNewPositionAlignOff/On`. Private
     * — only the drag pipeline reads it.
     */
    private draggedElementId = -1;

    /**
     * Ids of icons that have been displaced from their default grid
     * positions by a prior drag. Used by `autoAlignIcon` (snap-back)
     * and by the move helpers (so they don't double-count a moved
     * icon). Private — no other subsystem reads it.
     */
    private movedBtnIds: string[] = [];

    // #endregion

    // #region Drag — public methods (§1.1.4.3)

    /**
     * HTML5 drag spec quirk: `dragover` must call `preventDefault()`
     * for the subsequent `drop` to fire at all. We don't need the
     * event for anything else — this is purely the "yes, this is a
     * valid drop target" handshake.
     */
    onDragOver(event: DragEvent): void {
        event.stopPropagation();
        event.preventDefault();
    }

    /**
     * Drag-source initiator. Marks the desktop-originated drag active,
     * publishes the drag context to the system-notification service so
     * cross-window subscribers (file explorer) can see it, then asks
     * the alignment helper to build the drag image and stage the
     * payload in the file-service.
     *
     * The helper returns the resolved dragged-element id (which may
     * differ from `i` when a multi-select set is active and the user
     * grabbed one of the highlighted icons) — we stash it for the
     * later `onDragEnd` reposition pass.
     */
    onDragStart(evt: DragEvent, i: number): void {
        this.isDragFromDesktopActive = true;
        const dragEvtInfo: DragEventInfo = {
            origin: this._callbacks.getUniqueId(),
            currentLocation: Constants.EMPTY_STRING,
            isDragActive: this.isDragFromDesktopActive,
        };
        this._systemNotificationService.setDropEventInfo(dragEvtInfo);

        const countOfMarkedBtns = this.getCountOfAllTheMarkedButtons();
        // Helper returns the dragged-element id + the files we should stage in
        // FileService.  Registering them is the handler's job — the helper
        // itself stays pure / service-agnostic (§1.1.5).
        // §1.4 — helper now receives the clone-container ElementRef.nativeElement.
        const dragResult = DesktopIconAlignmentHelper.handleDragStart(
            evt,
            i,
            countOfMarkedBtns,
            this._callbacks.getFiles(),
            this._callbacks.elements.desktopIconCloneCntnr.nativeElement,
        );

        dragResult.filesToRegister.forEach(f => this._fileService.addDragAndDropFile(f));
        this.draggedElementId = dragResult.draggedElementId;
    }

    /**
     * Drag-source terminator. Clears the desktop-drag flag, builds a
     * `mousePosition` snapshot of the drop point, dispatches to the
     * align-on or align-off reposition pass, and finally tears down
     * the drag-image clone container.
     *
     * NOTE (preserved from the bug-fix sweep): the previous version
     * gated both branches on `markedBtnIds.length >= 0`, which is
     * tautologically true (an array's length is never negative) and
     * so guarded nothing. The intent was probably "only move when
     * there is something to move", but that's already handled inside
     * the helpers: when `markedBtnIds` is empty they temporarily
     * insert `draggedElementId` so the single dragged icon still gets
     * moved. The dead condition stays dropped.
     */
    onDragEnd(evt: DragEvent): void {
        this.isDragFromDesktopActive = false;
        const mPos: mousePosition = {
            clientX: evt.clientX,
            clientY: evt.clientY,
            offsetX: evt.offsetX,
            offsetY: evt.offsetY,
            x: evt.x,
            y: evt.y,
        };

        if (this.autoAlignIcons) {
            this.moveBtnIconsToNewPositionAlignOn(mPos);
        } else {
            this.moveBtnIconsToNewPositionAlignOff(mPos);
        }

        // §1.4 — pass the clone-container ElementRef.nativeElement.
        DesktopIconAlignmentHelper.clearCloneContainer(this._callbacks.elements.desktopIconCloneCntnr.nativeElement);
    }

    // #endregion

    // #region Drag — private methods (§1.1.4.3)

    /**
     * Move-icons pass when free-positioning is enabled (no grid
     * snap). Delegates to the alignment helper, which returns the
     * updated `markedBtnIds` (the helper may add the dragged element
     * to the set if it wasn't already part of a multi-select). Note
     * we re-assign rather than mutate in place — preserved verbatim.
     */
    private moveBtnIconsToNewPositionAlignOff(mPos: mousePosition): void {
        this.markedBtnIds = DesktopIconAlignmentHelper.handleMoveBtnIconsToNewPositionAlignOff(
            mPos,
            this.movedBtnIds,
            this.markedBtnIds,
            this.draggedElementId,
            this.GRID_SIZE,
        );
    }

    /**
     * Move-icons pass when grid-snap is enabled. Same shape as the
     * align-off variant but the helper additionally honors
     * `GRID_SIZE` + `ROW_GAP` to snap drop coordinates onto the grid.
     */
    private moveBtnIconsToNewPositionAlignOn(mPos: mousePosition): void {
        // §1.4 — pass the icon-grid ElementRef.nativeElement.
        this.markedBtnIds = DesktopIconAlignmentHelper.handleMoveBtnIconsToNewPositionAlignOn(
            mPos,
            this.movedBtnIds,
            this.markedBtnIds,
            this.draggedElementId,
            this.GRID_SIZE,
            this.ROW_GAP,
            this._callbacks.elements.desktopIconOl.nativeElement,
        );
    }

    // #endregion
}
