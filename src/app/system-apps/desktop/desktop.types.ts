import { ElementRef } from "@angular/core";
import { SortBys } from "src/app/system-files/common.enums";
import { Activity } from "src/app/system-files/common.interfaces";
import { FileInfo } from "src/app/system-files/file.info";

export interface mousePosition{
    clientX:number,
    clientY:number,
    offsetX:number,
    offsetY:number,
    x: number,
    y: number,
}

export enum IconsSizes { 
    LARGE_ICONS = 'Large Icons',  
    MEDIUM_ICONS = 'Medium Icons',  
    SMALL_ICONS = 'Small Icons',  
}

export enum IconsSizesPX { 
    LARGE_ICONS = 80,  
    MEDIUM_ICONS = 45,  
    SMALL_ICONS = 30,  
}

export enum ShortCutIconsSizes { 
    LARGE_ICONS = 21,  
    MEDIUM_ICONS = 12,  
    SMALL_ICONS = 8,  
}

export enum ShortCutIconsBottom { 
    LARGE_ICONS = 1,  
    MEDIUM_ICONS = -8,  
    SMALL_ICONS = -12,  
}



/**
 * Cross-cut callbacks the handler needs but cannot own yet, because the
 * state they operate on still lives on DesktopComponent during the
 * §1.1.4 extraction:
 *   - `refresh`                  — `refresh()` reads/writes the icon
 *                                  list (`files`) and selection state
 *                                  (`isIconInFocusDueToPriorAction`);
 *                                  the icon list migrates in §1.1.4.5.
 *   - `sortIcons`                — mutates the icon list directly.
 *   - `rebuildDesktopMenu`       — the desktop right-click menu is a
 *                                  desktop concern (not icons), so the
 *                                  builder stays on the component; the
 *                                  handler asks for a rebuild whenever
 *                                  a toggle (view-by / sort-by /
 *                                  auto-align / auto-arrange / icon
 *                                  visibility) changes the menu's
 *                                  highlighted entry.
 *   - `hideDesktopContextMenuAndOthers` — closes every open desktop
 *                                  surface (context menus, volume
 *                                  panel, overflow pane, start menu,
 *                                  power dialog). The selection logic
 *                                  must trigger this on every icon
 *                                  click. Owned by the component
 *                                  because it touches taskbar / start /
 *                                  audio / system surfaces that are
 *                                  beyond the icons handler's scope.
 *   - `isFormDirty`              — commit/abort the in-progress rename
 *                                  form. Selection logic calls this
 *                                  when the user clicks away from a
 *                                  rename. Rename form migrates in
 *                                  §1.1.4.5.
 *   - `getIsRenameActive`        — read the component's `isRenameActive`
 *                                  flag (set by the rename form).
 *                                  Selection branches on it inside
 *                                  `handleIconHighLightState`.
 *   - `getIsWindowDragActive`    — read the component's
 *                                  `isWindowDragActive` flag (set by
 *                                  window-service subscriptions). The
 *                                  lasso multi-select must NOT activate
 *                                  while a window is being dragged.
 *   - `clearDragAndDropFile`     — file-service teardown invoked when
 *                                  `clearStates()` discards a selection
 *                                  mid-drag. File ops move in §1.1.4.5.
 *   - `getUniqueId`              — `${name}-${processId}`, set by
 *                                  DesktopComponent.ngOnInit. The drag
 *                                  source handler stamps this onto the
 *                                  outbound `DragEventInfo` so the file
 *                                  explorer can recognise drops that
 *                                  originated on the desktop. Process
 *                                  bookkeeping stays component-owned.
 *   - `getFiles`                 — accessor for the icon list. The drag
 *                                  source handler maps the dragged
 *                                  index to a `FileInfo` so the
 *                                  file-service can stage the drag
 *                                  payload. The list migrates in
 *                                  §1.1.4.5; until then, accessor.
 *
 * Wired once during `DesktopComponent.ngOnInit` via `init(callbacks)`.
 * Mirrors the §1.1.3.3 `initContextMenuData(launcher)` pattern.
 */
export interface DesktopIconsHandlerInit {
    refresh: (trueRefresh: boolean) => Promise<void>;
    sortIcons: (sortBy: SortBys) => void;
    rebuildDesktopMenu: () => void;
    hideDesktopContextMenuAndOthers: (isDesktopTheCaller: boolean) => void;
    isFormDirty: () => void;
    getIsRenameActive: () => boolean;
    getIsWindowDragActive: () => boolean;
    /**
     * Whether the start menu is currently open. When true the desktop keyboard
     * handler stands down so the start menu owns navigation and the two don't
     * both react to the same keystroke.
     */
    getIsStartMenuOpen: () => boolean;
    clearDragAndDropFile: () => void;
    getUniqueId: () => string;
    getFiles: () => FileInfo[];
    /**
     * Keyboard-navigation hooks. The handler owns selection state
     * (currIconId / markedBtnIds) so it can resolve a focused icon
     * to an index, but launching / renaming / deleting belong to
     * the file-ops handler (or to the component's runApplication
     * orchestration). These callbacks bridge the two: the icons
     * handler picks the id, the component points it at the right
     * file and invokes the right method.
     *
     * `onTriggerOpenForId`   — Enter (run the focused icon's app).
     * `onTriggerRenameForId` — F2 (start in-place rename).
     * `onTriggerDeleteForId` — Delete (recycle-or-delete the icon).
     *
     * All three are no-ops by default so the handler stays callable
     * before `init()` (e.g. unit tests).
     */
    onTriggerOpenForId: (id: number) => void;
    onTriggerRenameForId: (id: number) => void;
    onTriggerDeleteForId: (id: number) => void;
    /**
     * §1.4 — the desktop's singleton DOM elements, bundled from the
     * component's `@ViewChild` bindings.  Replaces the prior
     * `document.getElementById('dskTopMultiSelectPane')` lookup and
     * gives the handler typed access to the icon grid for any future
     * DOM-touching code.
     */
    elements: DesktopRootElements;
}



/**
 * §1.4 — Strongly-typed bundle of the desktop's *singleton* DOM
 * elements (those that appear exactly once in the desktop template).
 *
 * Background: before this refactor, every handler and helper that
 * needed access to the desktop root, the icon grid, the clone
 * container, the multi-select pane, or the invalid-chars tooltip
 * looked them up by id with `document.getElementById(...)`.  That
 * scattered the same id strings across ~17 call sites in 6 files and
 * coupled component-scoped code to the global document.
 *
 * Now the `DesktopComponent` owns a `@ViewChild` for each singleton
 * and passes this bundle into every handler that needs DOM access.
 * Handlers store the bundle and dereference `nativeElement` on demand.
 * Pure helpers (which by §1.1.5 cannot inject Angular primitives)
 * receive the specific `HTMLElement` they need as a function argument.
 *
 * Note on `static: true`:
 *   All five elements live at the top level of the template — none of
 *   them are nested inside a structural directive (`*ngIf`, `@if`,
 *   `*ngFor`).  That means they are present in the view tree at the
 *   moment `ngOnInit` runs, and `@ViewChild(..., { static: true })`
 *   populates them in time for the existing `ngOnInit` wiring code
 *   (which is where the handlers get their `init(...)` calls).
 *
 * Note on naming:
 *   The legacy id `vantaCntnr` is preserved as the public field name
 *   so the migration is a 1:1 textual replacement at the call sites.
 *   A future naming pass (§1.6) may rename to `desktopRoot` once the
 *   Vanta-coupled wording is no longer accurate.
 */
export interface DesktopRootElements {
    /** `<main id="vantaCntnr">` — the desktop root that hosts the Vanta canvas. */
    vantaCntnr: ElementRef<HTMLElement>;
    /** `<ol id="desktopIcon_ol">` — the CSS-grid container for the icon tiles. */
    desktopIconOl: ElementRef<HTMLElement>;
    /** `<div id="desktopIcon_clone_cntnr">` — off-screen scratch for the drag-image clones. */
    desktopIconCloneCntnr: ElementRef<HTMLElement>;
    /** `<div id="dskTopMultiSelectPane">` — the rubber-band selection rectangle. */
    multiSelectPane: ElementRef<HTMLElement>;
    /** `<div id="invalidChars">` — the rename-textbox tooltip shown when illegal characters are typed. */
    invalidCharsToolTip: ElementRef<HTMLElement>;
}


/**
 * Descriptor returned by `prepareAppLaunch`.  Carries everything the caller
 * needs to actually launch the app on its own services — the helper itself
 * never imports or touches application services (§1.1.5: pure-helper rule).
 */
export interface AppLaunchDescriptor {
    /** Pre-populated `FileInfo` to hand to `ProcessHandlerService.runApplication`. */
    file: FileInfo;
    /** Activity to track via `CommonFunctions.trackActivity`, or `null` to skip. */
    activityToTrack: Activity | null;
}


/**
 * Recycle-bin row toggles ("Confirm Delete" and "Recycle on Delete") are
 * driven by booleans the caller pre-reads from `DefaultService`.  Passing
 * them in keeps this helper a pure data/DOM utility — it never imports or
 * touches application services.
 */
export interface RecycleBinToggleState {
    /** Show the "Confirm Delete" check-mark icon. */
    showDelete: boolean;
    /** Show the "Recycle on Delete" check-mark icon. */
    moveToRecycle: boolean;
}


/**
 * Returned by `handleDragStart` so the caller can register each file
 * with `FileService.addDragAndDropFile(...)` itself.  Keeps this helper
 * purely DOM-bound — it never imports application services (§1.1.5).
 */
export interface DragStartResult {
    /** Id of the icon under the user's pointer at drag-start (-1 if none). */
    draggedElementId: number;
    /** Files the caller should register on `FileService` as the drag payload. */
    filesToRegister: FileInfo[];
}