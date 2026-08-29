import { Injectable } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { GeneralMenu } from 'src/app/shared/system-ui-components/menu/menu.types';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { DesktopContextMenuHelper } from '../desktop.context.menu.helper';
import { DesktopRootElements } from '../desktop.types';
import { TaskBarIconInfo, TaskBarPreviewPositionInfo, TooltipPositionInfo } from '../../taskbarentries/taskbar.entries.type';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';

/**
 * TaskbarMenu — extracted from DesktopComponent (§1.1.3).
 *
 * Handler ownership by stage:
 *   - §1.1.3.1 (done): preview-window lifecycle + tooltip lifecycle.
 *   - §1.1.3.2 (done): taskbar app-icon context menu.
 *   - §1.1.3.3 (this stage): taskbar empty-area context menu, taskbar
 *                             visibility (hide / show / temporary-show),
 *                             and merge/unmerge state.
 *
 * Provided at the COMPONENT scope (in DesktopComponent.providers) for
 * consistency with DesktopBackgroundHandler. The desktop is never
 * destroyed in practice, but pinning lifetime to the component keeps
 * timer ownership unambiguous and parallels the §1.1.2 extraction.
 *
 * State is exposed as public fields (NOT getters) so the template can
 * bind to them directly via `taskbarMenu.<field>`. Behavioural changes
 * vs the original implementation:
 *   - None intended. All timing constants, timer IDs, positioning
 *     offsets, and ordering of side-effects are preserved verbatim
 *     from desktop.component.ts.
 */
@Injectable()
export class TaskbarMenuHandler {

    constructor(
        private readonly _menuService: MenuService,
        private readonly _runningProcessService: RunningProcessService,
        private readonly _processHandlerService: ProcessHandlerService,
        private readonly _systemNotificationServices: SystemNotificationService,
        private readonly _defaultService: DefaultService,
    ) {
        // The menu service raises this Subject whenever "show open windows"
        // is dismissed elsewhere in the system and the row-0 menu entry
        // needs to revert to 'Show the desktop'. Owned here because the
        // entry it mutates is owned here (§1.1.3.3).
        this._menuService.updateTaskBarContextMenu.subscribe(() => { this.resetMenuOption(); });
    }

    /**
     * §1.4 — the desktop's singleton DOM elements, supplied by
     * `DesktopComponent.ngOnInit` via `setRootElements(...)`.  Used
     * (currently) only by `showTaskBarTemporarily` to read the desktop
     * height; future DOM-touching code in this handler should resolve
     * elements through this bundle rather than `document.getElementById`.
     */
    private _elements: DesktopRootElements | null = null;

    /**
     * Inject the singleton DOM refs.  Called once from
     * `DesktopComponent.ngOnInit`, matching the wiring point used for
     * the other handler `init(...)` calls.
     */
    setRootElements(elements: DesktopRootElements): void {
        this._elements = elements;
    }

    // #region Preview window — public state (bound from template)

    /** Drives `*ngIf="taskbarMenu.showPreviewWindow"` in the template. */
    showPreviewWindow = false;
    /** Fade animation state for the preview component. */
    previewWindowState: string = 'in';
    /** App name shown in the preview header. */
    appToPreview: string = Constants.EMPTY_STRING;
    /** App icon shown in the preview header. */
    appToPreviewIcon: string = Constants.EMPTY_STRING;
    /** Inline style binding for the preview container. */
    previewWindowStyle: Record<string, unknown> = {};

    // #endregion

    // #region Tooltip — public state (bound from template)

    /** Drives `@if(taskbarMenu.showToolTip)` in the template. */
    showToolTip = false;
    /** Tooltip text content. */
    toolTipText: string = Constants.EMPTY_STRING;
    /** Inline style binding for the tooltip container. */
    toolTipStyle: Record<string, unknown> = {};

    // #endregion

    // #region App-icon menu — public state (bound from template)

    /** Drives `*ngIf="taskbarMenu.showAppIconMenu"` in the template. */
    showAppIconMenu = false;

    /** Menu-type discriminator passed to <cos-menu>. */
    readonly appIconMenuOption = Constants.TASK_BAR_APP_ICON_MENU_OPTION;

    /** Inline style binding (position) for the app-icon menu container. */
    appIconMenuStyle: Record<string, unknown> = {};

    /**
     * Menu entries shown for the right-clicked taskbar app icon. The
     * array is mutated in place by `switchBetweenPinAndUnpin` and
     * `countInstaceAndSetMenu`:
     *   - [0] Open the app (icon + label set per app)
     *   - [1] Pin / Unpin (swapped per pinned-state)
     *   - [2] Close window / Close all windows (added when processCount
     *         > 0; popped when processCount === 0)
     */
    appIconMenuData: GeneralMenu[] = [
        { icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: this.initApplicationFromTaskBar.bind(this) },
        { icon: Constants.EMPTY_STRING, label: Constants.EMPTY_STRING, action: () => console.log() },
    ];

    // #endregion

    // #region App-icon menu — private state

    /**
     * The FileInfo of the currently-right-clicked taskbar icon. Stashed
     * by `openAppIconMenu` and read by the action handlers (init/close/
     * pin/unpin) when the user picks an entry.
     */
    private _selectedTaskBarFile!: FileInfo;

    /** Pixel offsets for the app-icon menu. The menu is horizontally CENTERED
     *  over the taskbar icon at runtime (see `openAppIconMenu`) using the icon's
     *  live width, so it lines up in both Merged (~40px) and Unmerged (~130px)
     *  taskbar states. The width below is the rendered menu width
     *  (`.dm-tskbar-vertical-menu` in menu.component.css). */
    private static readonly APP_ICON_MENU_WIDTH_PX = 205;
    private static readonly APP_ICON_MENU_Y_OFFSET_NO_INSTANCES_PX = -72;
    private static readonly APP_ICON_MENU_Y_OFFSET_WITH_INSTANCES_PX = -104;

    // #endregion

    // #region Preview window — private state

    /**
     * Tracks the most-recently-requested preview's app name so a
     * subsequent hover on the SAME app doesn't trigger the delayed-show
     * dance — it just re-shows immediately. Different app => kick off
     * the debounce window so the user has a moment to scrub through
     * taskbar icons without flashing previews for each one.
     */
    private previousDisplayedPreviewApp: string = Constants.EMPTY_STRING;

    /**
     * Pending delayed-show timer (350ms). Set when a NEW app's preview
     * is requested; canceled by another show request landing inside the
     * window, or by any hide path so a brief hover can't re-open the
     * preview after the user has moved on.
     */
    private taskbarHideDelayTimeOutId!: NodeJS.Timeout;

    /** Drives the 'out' fade state 100ms after hide is requested. */
    private hidePreviewWindowTimeoutId!: NodeJS.Timeout;

    /** Removes the preview from the DOM 300ms after hide is requested. */
    private removePreviewWindowFromDOMTimeoutId!: NodeJS.Timeout;

    /**
     * Delay (ms) before the preview actually appears when switching to a
     * new app. Smooths out rapid hover-scrubbing across multiple taskbar
     * icons — the preview only commits if the cursor pauses long enough
     * for the user to "mean it".
     */
    private static readonly PREVIEW_DELAYED_SHOW_MS = 350;

    /** Delay (ms) before flipping the fade animation to 'out'. */
    private static readonly PREVIEW_FADE_OUT_MS = 100;

    /** Delay (ms) before removing the preview node from the DOM. */
    private static readonly PREVIEW_DOM_REMOVAL_MS = 300;

    /**
     * Pixel offset added to `rect.top` when positioning the preview.
     * Negative because the preview floats ABOVE the taskbar icon.
     */
    private static readonly PREVIEW_VERTICAL_OFFSET_PX = -132;

    // #endregion

    // #region Tooltip — private state

    /** Delayed-show timer for the tooltip (1s after hover). */
    private showToolTipTimeoutId!: NodeJS.Timeout;

    /** Auto-dismiss timer (5s after the tooltip becomes visible). */
    private autoHideToolTipTimeoutId!: NodeJS.Timeout;

    /** Delay (ms) before a hover commits to showing the tooltip. */
    private static readonly TOOLTIP_SHOW_DELAY_MS = 1000;

    /** Delay (ms) after which a visible tooltip auto-dismisses. */
    private static readonly TOOLTIP_AUTO_HIDE_MS = 5000;

    /**
     * Pixel offset added to `data.top` when positioning the tooltip.
     * Negative because the tooltip floats ABOVE its anchor.
     */
    private static readonly TOOLTIP_VERTICAL_OFFSET_PX = -20;

    // #endregion

    // #region Preview window — public methods

    /**
     * Show the taskbar preview window for the app indicated by `data`.
     *
     * Behaviour preserved exactly from the original implementation:
     *   - First request for a NEW app: cancel any pending delayed-show,
     *     hide the preview, then re-show after PREVIEW_DELAYED_SHOW_MS
     *     so rapid hover-scrubbing doesn't flash a preview for every
     *     taskbar icon the cursor crosses.
     *   - Subsequent request for the SAME app: show immediately AND
     *     clear pending hide timers (the user came back before the
     *     fade-out finished — keep it on screen).
     *   - Always dismisses the app-icon menu first (matches the
     *     original `this.hideTaskBarAppIconMenu()` call site).
     */
    showPreview(data: TaskBarPreviewPositionInfo): void {
        const rect = data.rect;
        const appName = data.appName;
        const iconPath = data.iconPath;

        this.appToPreview = appName;
        this.appToPreviewIcon = iconPath;
        // The app-icon menu (§1.1.3.2) lives in this same handler now, so
        // we can dismiss it directly without the Subject-based cross-cut
        // that bridged the gap during §1.1.3.1.
        this.hideAppIconMenu();

        if (this.previousDisplayedPreviewApp !== appName) {
            // New app: cancel any pending delayed-show for the PRIOR app
            // before starting a fresh one. If we didn't, that older
            // timer would fire and briefly show the wrong preview.
            if (this.taskbarHideDelayTimeOutId) {
                clearTimeout(this.taskbarHideDelayTimeOutId);
            }
            this.showPreviewWindow = false;
            this.previousDisplayedPreviewApp = appName;

            this.taskbarHideDelayTimeOutId = setTimeout(() => {
                this.showPreviewWindow = true;
                this.previewWindowState = 'in';
            }, TaskbarMenuHandler.PREVIEW_DELAYED_SHOW_MS);
        } else {
            // Same app re-entered: show now, cancel any in-flight hide
            // animations so we don't fade out a preview the user is
            // actively pointing at.
            this.showPreviewWindow = true;
            this.previewWindowState = 'in';
            this.clearPreviewTimeouts();
        }

        this.previewWindowStyle = {
            'position': 'absolute',
            'transform': `translate(${rect.left}px, ${rect.top + TaskbarMenuHandler.PREVIEW_VERTICAL_OFFSET_PX}px)`,
            'z-index': Constants.Z_INDEX_TASKBAR_ELEMENTS,
        };
    }

    /**
     * Begin the preview hide sequence: fade-out at 100ms, DOM removal at
     * 300ms. Also cancels any pending delayed-show so a brief hover that
     * already started the 350ms timer can't re-open the preview after we
     * just decided to close it.
     */
    hidePreview(): void {
        // Cancel any pending delayed-show from a brief hover; otherwise
        // it can fire after the hide path completes and leave the
        // preview stuck open.
        clearTimeout(this.taskbarHideDelayTimeOutId);

        this.hidePreviewWindowTimeoutId = setTimeout(() => {
            this.previewWindowState = 'out';
        }, TaskbarMenuHandler.PREVIEW_FADE_OUT_MS);

        this.removePreviewWindowFromDOMTimeoutId = setTimeout(() => {
            this.showPreviewWindow = false;
        }, TaskbarMenuHandler.PREVIEW_DOM_REMOVAL_MS);
    }

    /**
     * Keep the currently-shown preview visible: called when the cursor
     * moves INTO the preview window itself, so the in-flight hide
     * timers (from the cursor having briefly left its taskbar icon)
     * should be cancelled.
     */
    keepPreview(): void {
        this.clearPreviewTimeouts();
    }

    /**
     * Force the preview offscreen immediately, with no fade. Used when
     * another taskbar surface (e.g. the app-icon context menu) is about
     * to appear in the same screen region — we don't want a fading
     * preview overlapping the new menu.
     */
    removeOldPreviewWindowNow(): void {
        this.showPreviewWindow = false;
    }

    // #endregion

    // #region Tooltip — public methods

    /**
     * Show the taskbar icon tooltip after TOOLTIP_SHOW_DELAY_MS, then
     * auto-dismiss after TOOLTIP_AUTO_HIDE_MS. Any in-flight show timer
     * is cleared so a fast re-hover restarts the debounce window
     * cleanly.
     */
    showTooltip(data: TooltipPositionInfo): void {
        const xAxis = data.left;
        const yAxis = data.top;
        const appName = data.appName;

        this.toolTipText = appName;

        if (this.showToolTipTimeoutId)
            clearTimeout(this.showToolTipTimeoutId);

        this.showToolTipTimeoutId = setTimeout(() => {
            this.showToolTip = true;
            this.toolTipStyle = {
                'position': 'absolute',
                'z-index': Constants.Z_INDEX_TASKBAR_ELEMENTS,
                'transform': `translate(${xAxis}px, ${yAxis + TaskbarMenuHandler.TOOLTIP_VERTICAL_OFFSET_PX}px)`,
            };

            this.autoHideTooltip();
        }, TaskbarMenuHandler.TOOLTIP_SHOW_DELAY_MS);
    }

    /**
     * Hide the tooltip immediately and cancel both the delayed-show and
     * auto-dismiss timers, so neither can wake the tooltip back up
     * after an explicit hide.
     */
    hideTooltip(): void {
        if (this.showToolTipTimeoutId)
            clearTimeout(this.showToolTipTimeoutId);

        if (this.autoHideToolTipTimeoutId)
            clearTimeout(this.autoHideToolTipTimeoutId);

        this.showToolTip = false;
    }

    // #endregion

    // #region Private helpers

    /**
     * Clear EVERY preview-related timer:
     *   - The fade-to-'out' timer.
     *   - The DOM-removal timer.
     *   - The delayed-show timer (a brief hover that already started the
     *     350ms timer must not re-open the preview after a hide path).
     *
     * Public surface is `keepPreview()`; this is the shared
     * implementation used by both `keepPreview()` and `showPreview()`'s
     * same-app branch.
     */
    private clearPreviewTimeouts(): void {
        clearTimeout(this.hidePreviewWindowTimeoutId);
        clearTimeout(this.removePreviewWindowFromDOMTimeoutId);
        clearTimeout(this.taskbarHideDelayTimeOutId);
    }

    /**
     * Schedule the visible tooltip to auto-dismiss after
     * TOOLTIP_AUTO_HIDE_MS. Called from inside the delayed-show
     * callback so the auto-hide clock only starts ticking once the
     * tooltip is actually on screen.
     */
    private autoHideTooltip(): void {
        this.autoHideToolTipTimeoutId = setTimeout(() => {
            this.hideTooltip();
        }, TaskbarMenuHandler.TOOLTIP_AUTO_HIDE_MS);
    }

    // #endregion

    // #region App-icon menu — public methods

    /**
     * Open the right-click context menu for a taskbar app icon. Called
     * from DesktopComponent's `onShowTaskBarAppIconMenu` orchestrator
     * AFTER it has done the desktop-wide reset + DESKTOP_MENU_DELAY
     * sleep (those are desktop-level concerns the handler doesn't
     * own).
     *
     * Behaviour preserved verbatim from the original
     * `onShowTaskBarAppIconMenu`:
     *   - Builds a transient `FileInfo` from the taskbar icon data,
     *     stashes it as `_selectedTaskBarFile` for the action handlers.
     *   - Toggles Pin <-> Unpin based on `isPinned || isOtherPinned`.
     *     (The two flags model "this exact taskbar entry is pinned" vs
     *     "another instance of the same app is pinned"; either case
     *     means the user should see 'Unpin from taskbar'.)
     *   - Updates the menu's row 0 (icon/label) and row 2 (close
     *     entry — added/removed/relabeled based on process count) via
     *     `countInstaceAndSetMenu`.
     *   - Removes any visible preview window immediately (no fade) so
     *     it can't overlap the menu we're about to draw.
     *   - Positions the menu above the taskbar icon, with a different
     *     y-offset depending on whether row 2 (close entry) is
     *     present.
     */
    openAppIconMenu(rect: DOMRect, tskBarIcon: TaskBarIconInfo): void {
        const file = new FileInfo();
        file.setOpensWith = tskBarIcon.opensWith;
        file.setIconPath = tskBarIcon.defaultIconPath;
        this._selectedTaskBarFile = file;

        if ((tskBarIcon.isPinned && tskBarIcon.isOtherPinned) || (!tskBarIcon.isPinned && tskBarIcon.isOtherPinned))
            this.switchBetweenPinAndUnpin(true);
        else
            this.switchBetweenPinAndUnpin(false);
        // first count, then show the cntxt menu
        const processCount = this.countInstaceAndSetMenu();

        this.removeOldPreviewWindowNow();
        this.showAppIconMenu = true;

        // Center the menu over the icon: works for both Merged (~40px) and
        // Unmerged (~130px) icon widths since `rect.width` is the live icon size.
        const menuX = rect.x + (rect.width - TaskbarMenuHandler.APP_ICON_MENU_WIDTH_PX) / 2;

        if (processCount === 0) {
            this.appIconMenuStyle = {
                'position': 'absolute',
                'transform': `translate(${String(menuX)}px, ${String(rect.y + TaskbarMenuHandler.APP_ICON_MENU_Y_OFFSET_NO_INSTANCES_PX)}px)`,
                'z-index': Constants.Z_INDEX_TASKBAR_ELEMENTS,
            };
        } else {
            this.appIconMenuStyle = {
                'position': 'absolute',
                'transform': `translate(${String(menuX)}px, ${String(rect.y + TaskbarMenuHandler.APP_ICON_MENU_Y_OFFSET_WITH_INSTANCES_PX)}px)`,
                'z-index': Constants.Z_INDEX_TASKBAR_ELEMENTS,
            };
        }
    }

    /** Hide the app-icon context menu. */
    hideAppIconMenu(): void {
        this.showAppIconMenu = false;
    }

    // #endregion

    // #region App-icon menu — private helpers

    /**
     * Swap the row-1 menu entry between 'Pin to taskbar' and 'Unpin
     * from taskbar' based on whether the app is currently pinned.
     *
     * `isAppPinned` is a plain boolean, so the only remaining case
     * after the `if` is `false` — a redundant `else if(!isAppPinned)`
     * was previously used, which reads as if a third case might exist
     * and would silently change behaviour if the parameter type were
     * ever widened. Plain `else` is exhaustive by construction.
     */
    private switchBetweenPinAndUnpin(isAppPinned: boolean): void {
        if (isAppPinned) {
            const menuEntry = { icon: Constants.EMPTY_STRING, label: MenuAction.UNPIN_FROM_TASKBAR, action: this.unPinApplicationFromTaskBar.bind(this) };
            const rowOne = this.appIconMenuData[1];
            rowOne.icon = menuEntry.icon;
            rowOne.label = menuEntry.label;
            rowOne.action = menuEntry.action;
            this.appIconMenuData[1] = rowOne;
        } else {
            const menuEntry = { icon: Constants.EMPTY_STRING, label: MenuAction.PIN_TO_TASKBAR, action: this.pinApplicationFromTaskBar.bind(this) };
            const rowOne = this.appIconMenuData[1];
            rowOne.icon = menuEntry.icon;
            rowOne.label = menuEntry.label;
            rowOne.action = menuEntry.action;
            this.appIconMenuData[1] = rowOne;
        }
    }

    /**
     * Update row 0 (icon/label for the selected app) and row 2 (the
     * close entry, which is added/removed/relabeled based on how many
     * instances of the app are currently running):
     *   - 0 instances: pop row 2 if present (no close entry needed).
     *   - 1 instance:  ensure row 2 exists and reads 'Close window'.
     *   - 2+ instances: ensure row 2 exists and reads 'Close all windows'.
     *
     * Returns the process count so the caller can vary menu placement
     * (rows == 2 vs rows == 3 changes the visible height).
     *
     * NOTE: the method name retains the legacy typo
     * ('Instace'→'Instance'); fix is queued for §1.6 with the other
     * naming touchups.
     */
    private countInstaceAndSetMenu(): number {
        const file = this._selectedTaskBarFile;
        const processCount = this._runningProcessService.getProcessCount(file.getOpensWith);

        const rowZero = this.appIconMenuData[0];
        rowZero.icon = file.getIconPath;
        rowZero.label = file.getOpensWith;
        this.appIconMenuData[0] = rowZero;

        if (processCount === 0) {
            if (this.appIconMenuData.length === 3) {
                this.appIconMenuData.pop();
            }
        } else if (processCount === 1) {
            if (this.appIconMenuData.length === 2) {
                const menuEntry = { icon: Constants.EMPTY_STRING, label: MenuAction.CLOSE_WINDOW, action: this.closeApplicationFromTaskBar.bind(this) };
                this.appIconMenuData.push(menuEntry);
            } else {
                const rowTwo = this.appIconMenuData[2];
                rowTwo.label = MenuAction.CLOSE_WINDOW;
                this.appIconMenuData[2] = rowTwo;
            }
        } else {
            const rowTwo = this.appIconMenuData[2];
            if (!rowTwo) {
                const menuEntry = { icon: Constants.EMPTY_STRING, label: MenuAction.CLOSE_ALL_WINDOWS, action: this.closeApplicationFromTaskBar.bind(this) };
                this.appIconMenuData.push(menuEntry);
            } else {
                rowTwo.label = MenuAction.CLOSE_ALL_WINDOWS;
                this.appIconMenuData[2] = rowTwo;
            }
        }

        return processCount;
    }

    /**
     * Row 0 action: launch the selected app. Bound at construction time
     * into `appIconMenuData[0].action`.
     */
    private initApplicationFromTaskBar(): void {
        this.showAppIconMenu = false;
        const file = this._selectedTaskBarFile;
        this._processHandlerService.runApplication(file);
    }

    /**
     * Row 2 action (when present): close every running process matching
     * the selected app. Bound dynamically into `appIconMenuData[2].action`
     * by `countInstaceAndSetMenu`.
     */
    private closeApplicationFromTaskBar(): void {
        this.showAppIconMenu = false;
        const file = this._selectedTaskBarFile;
        const proccesses = this._runningProcessService.getProcesses()
            .filter(p => p.getProcessName === file.getOpensWith);

        this._menuService.closeApplicationFromTaskBar.next(proccesses);
    }

    /**
     * Row 1 action when the app is NOT pinned. Bound dynamically by
     * `switchBetweenPinAndUnpin`.
     */
    private pinApplicationFromTaskBar(): void {
        this.showAppIconMenu = false;
        const file = this._selectedTaskBarFile;
        this._menuService.pinToTaskBar.next(file);
    }

    /**
     * Row 1 action when the app IS pinned. Bound dynamically by
     * `switchBetweenPinAndUnpin`.
     */
    private unPinApplicationFromTaskBar(): void {
        this.showAppIconMenu = false;
        const file = this._selectedTaskBarFile;
        this._menuService.unPinFromTaskBar.next(file);
    }

    // #endregion

    // #region Context menu — public state (bound from template)

    /** Drives `*ngIf="taskbarMenu.showContextMenu"` in the template. */
    showContextMenu = false;

    /** Menu-type discriminator passed to <cos-menu>. */
    readonly contextMenuOption = Constants.TASK_BAR_CONTEXT_MENU_OPTION;

    /** Inline style binding (position) for the context menu container. */
    contextMenuStyle: Record<string, unknown> = {};

    /**
     * Menu entries for the empty-area taskbar right-click menu. Rows:
     *   - [0] 'Show the desktop' / 'Show open windows' (toggled by
     *         `showTheDesktop` / `resetMenuOption` / `showOpenWindows`)
     *   - [1] 'Task Manager' (action provided by the component via
     *         `initContextMenuData`; the desktop is the only thing that
     *         knows how to spawn the Task Manager app)
     *   - [2] 'Hide the taskbar' / 'Show the taskbar' (toggled by
     *         `hideTheTaskBar` / `showTheTaskBar`)
     *   - [3] 'Merge taskbar Icons' / 'Unmerge taskbar Icons' (toggled
     *         by `mergeTaskBarButton` / `unMergeTaskBarButton`)
     */
    contextMenuData: GeneralMenu[] = [];

    // #endregion

    // #region Visibility / merge — public state

    /**
     * `true` when the user has chosen 'Hide the taskbar'. Read by the
     * desktop's `performTasks` mousemove handler so a hidden taskbar
     * can be peek-shown when the cursor reaches the bottom of the
     * screen.
     */
    isTaskBarHidden = false;

    /**
     * `true` while the taskbar is peek-shown (cursor within
     * `TMP_TASKBAR_DISPLAY_HEIGHT_PX` of the bottom edge while hidden).
     * Public so unit tests can observe it; not template-bound.
     */
    isTaskBarTemporarilyVisible = false;

    // #endregion

    // #region Context menu — private state / constants

    /**
     * Spawned by the component (not the handler) because launching apps
     * is a desktop-level concern that needs the desktop's app-id
     * constants and the activity-history service. The component
     * registers its `openTaskManager` via `initContextMenuData`.
     */
    private _taskManagerLauncher: () => void = () => { /* set via initContextMenuData */ };

    /**
     * Hand-measured dimensions of the rendered context menu. Required
     * by `DesktopContextMenuHelper.checkAndHandleDesktopCntxtMenuBounds`
     * so the menu can be flipped above/left of the click if it would
     * overflow the viewport. Preserved verbatim from the original
     * `onShowTaskBarContextMenu`.
     */
    private static readonly CONTEXT_MENU_HEIGHT_PX = 116;
    private static readonly CONTEXT_MENU_WIDTH_PX = 203;

    /**
     * Standard taskbar height (px). Used by both the context-menu
     * placement math (so the menu hovers above the taskbar instead of
     * overlapping it) and the peek-show "is the cursor inside the
     * taskbar gutter" check in `showTaskBarTemporarily`.
     */
    private static readonly TASKBAR_HEIGHT_PX = 40;

    /**
     * Pixel band at the bottom of the screen that triggers a peek-show
     * of the hidden taskbar. Deliberately small (5px) so just *being
     * near* the bottom doesn't trigger — the user has to commit to
     * reaching for the taskbar.
     */
    private static readonly TMP_TASKBAR_DISPLAY_HEIGHT_PX = 5;

    /** Horizontal nudge applied to the bounds-checker's chosen x-axis. */
    private static readonly CONTEXT_MENU_X_NUDGE_PX = 2;

    // #endregion

    // #region Context menu — public methods

    /**
     * Build the empty-area context-menu rows. Called once by the
     * desktop component during `ngOnInit`. The `taskManagerLauncher`
     * callback is supplied by the component because the Task Manager
     * row is the one entry the handler cannot self-service (launching
     * apps requires desktop-level state).
     */
    initContextMenuData(taskManagerLauncher: () => void): void {
        this._taskManagerLauncher = taskManagerLauncher;
        const empty = Constants.EMPTY_STRING;
        this.contextMenuData = [            
            { icon: empty, label: MenuAction.SHOW_THE_DESKTOP, action: this.showTheDesktop.bind(this) },
            { icon: `${Constants.IMAGE_BASE_PATH}taskmanager_2.png`, label: MenuAction.TASK_MANAGER, action: () => this._taskManagerLauncher() },
            { icon: empty, label: MenuAction.HIDE_THE_TASKBAR, action: this.hideTheTaskBar.bind(this) },
            { icon: empty, label: MenuAction.MERGE_TASKBAR_ICONS, action: this.mergeTaskBarButton.bind(this) },
        ];
    }

    /**
     * Show the empty-area context menu at the click position. The
     * caller (DesktopComponent.onShowTaskBarContextMenu) already
     * handles the desktop-wide reset + DESKTOP_MENU_DELAY sleep before
     * calling here (see the §1.1.3.2 justification for why the
     * orchestrator stays on the component).
     *
     * Returns the `isShiftSubMenuLeft` flag from the bounds-checker
     * because that flag is a DESKTOP-level concern (the same flag is
     * also written by the desktop's own right-click context menu, which
     * has nested submenus), so the desktop component keeps owning it.
     */
    openContextMenu(evt: MouseEvent): boolean {
        // §1.4 — pass the desktop root ElementRef.nativeElement so the
        // helper doesn't have to `document.getElementById('vantaCntnr')`.
        const result = DesktopContextMenuHelper.checkAndHandleDesktopCntxtMenuBounds(
            evt,
            TaskbarMenuHandler.CONTEXT_MENU_HEIGHT_PX,
            TaskbarMenuHandler.CONTEXT_MENU_WIDTH_PX,
            this._elements?.vantaCntnr.nativeElement ?? null,
        );
        const axis = result[0];
        const isShiftSubMenuLeft = result[1];

        this.showContextMenu = true;
        this.contextMenuStyle = {
            'position': 'absolute',
            'transform': `translate(${axis.xAxis + TaskbarMenuHandler.CONTEXT_MENU_X_NUDGE_PX}px, ${evt.y - TaskbarMenuHandler.CONTEXT_MENU_HEIGHT_PX - TaskbarMenuHandler.TASKBAR_HEIGHT_PX}px)`,
            'z-index': Constants.Z_INDEX_TASKBAR_ELEMENTS,
        };

        return isShiftSubMenuLeft;
    }

    /** Hide the empty-area context menu. */
    hideContextMenu(): void {
        this.showContextMenu = false;
    }

    // #endregion

    // #region Context menu — row 0 (Show the desktop / Show open windows)

    /**
     * Row-0 action when label reads 'Show the desktop': raise the
     * system-wide "show the desktop" event and flip the label to
     * 'Show open windows' so a second click reverses the action.
     */
    showTheDesktop(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.SHOW_OPEN_WINDOWS, action: this.showOpenWindows.bind(this) };
        this._menuService.showTheDesktop.next();
        this.contextMenuData[0] = menuOption;
    }

    /**
     * Reset row 0 back to 'Show the desktop'. Called when an external
     * signal (`menuService.updateTaskBarContextMenu`) indicates a
     * window has been re-opened, so the user's next click should
     * minimize again rather than restore.
     */
    resetMenuOption(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.SHOW_THE_DESKTOP, action: this.showTheDesktop.bind(this) };
        this.contextMenuData[0] = menuOption;
    }

    /**
     * Row-0 action when label reads 'Show open windows' (after a prior
     * 'Show the desktop' click): raise the corresponding system event
     * and flip the label back to 'Show the desktop'.
     */
    showOpenWindows(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.SHOW_THE_DESKTOP, action: this.showTheDesktop.bind(this) };
        this._menuService.showOpenWindows.next();
        this.contextMenuData[0] = menuOption;
    }

    // #endregion

    // #region Context menu — row 2 (Hide / Show the taskbar)

    /**
     * Row-2 action when taskbar is visible: hide the taskbar, flip the
     * label to 'Show the taskbar', and persist the new auto-hide
     * setting via `setOrUpdateTaskBarVisibilityState`.
     */
    hideTheTaskBar(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.SHOW_THE_TASKBAR, action: this.showTheTaskBar.bind(this) };
        this.isTaskBarHidden = true;
        this._systemNotificationServices.hideTaskBarNotify.next();
        this.contextMenuData[2] = menuOption;
        this.setOrUpdateTaskBarVisibilityState('hideTaskbar');
    }

    /**
     * Row-2 action when taskbar is hidden: show the taskbar, flip the
     * label to 'Hide the taskbar', and persist the new auto-hide
     * setting.
     */
    showTheTaskBar(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.HIDE_THE_TASKBAR, action: this.hideTheTaskBar.bind(this) };
        this.isTaskBarHidden = false;
        this._systemNotificationServices.showTaskBarNotify.next();
        this.contextMenuData[2] = menuOption;
        this.setOrUpdateTaskBarVisibilityState('showTaskbar');
    }

    // #endregion

    // #region Context menu — row 3 (Merge / Unmerge)

    /**
     * Row-3 action: enable taskbar-button merging. Emits the menu
     * service event (taskbar component listens), flips the row label
     * to its inverse, and persists the setting.
     */
    mergeTaskBarButton(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.UNMERGE_TASKBAR_ICONS, action: this.unMergeTaskBarButton.bind(this) };
        this._menuService.mergeTaskBarIcon.next();
        this.contextMenuData[3] = menuOption;
        this.setOrUpdateTaskBarCombinationState('mergeTaskbar');
    }

    /**
     * Row-3 action: disable taskbar-button merging. Mirror of
     * `mergeTaskBarButton`.
     */
    unMergeTaskBarButton(): void {
        const menuOption: GeneralMenu = { icon: Constants.EMPTY_STRING, label: MenuAction.MERGE_TASKBAR_ICONS, action: this.mergeTaskBarButton.bind(this) };
        this._menuService.UnMergeTaskBarIcon.next();
        this.contextMenuData[3] = menuOption;
        this.setOrUpdateTaskBarCombinationState('unMergeTaskbar');
    }

    // #endregion

    // #region Persisted state — visibility / combination

    /**
     * Bidirectional sync between in-memory taskbar visibility and the
     * persisted DEFAULT_AUTO_HIDE_TASKBAR setting.
     *   - Called with no arg (e.g. from `ngOnInit` or a settings-change
     *     notification): READ the stored value and apply it by calling
     *     `showTheTaskBar()` / `hideTheTaskBar()`. Those methods will
     *     themselves call back into this method with an `action`, but
     *     `raiseEvent=false` on the update prevents an infinite loop.
     *   - Called with an `action` ('showTaskbar' / 'hideTaskbar'):
     *     WRITE the corresponding default-setting value (without
     *     raising a change event, since the in-memory state is already
     *     in sync with what we're persisting).
     */
    setOrUpdateTaskBarVisibilityState(actions?: string): void {
        let taskbarVisiblityState = Constants.EMPTY_STRING;
        if (!actions) {
            taskbarVisiblityState = this._defaultService.getDefaultSetting(Constants.DEFAULT_AUTO_HIDE_TASKBAR);
            if (taskbarVisiblityState === Constants.FALSE) {
                this.showTheTaskBar();
            } else if (taskbarVisiblityState === Constants.TRUE) {
                this.hideTheTaskBar();
            }
        } else {
            const raiseEvent = false;
            taskbarVisiblityState = (actions === 'showTaskbar') ? Constants.FALSE : Constants.TRUE;
            this._defaultService.updateDefaultData(Constants.DEFAULT_AUTO_HIDE_TASKBAR, taskbarVisiblityState, raiseEvent);
        }
    }

    /**
     * Bidirectional sync for DEFAULT_TASKBAR_COMBINATION. Same pattern
     * as `setOrUpdateTaskBarVisibilityState`:
     *   - No arg => READ + apply via `mergeTaskBarButton` / `unMergeTaskBarButton`.
     *   - With arg => WRITE the corresponding default (no event raise).
     */
    setOrUpdateTaskBarCombinationState(action?: string): void {
        let taskbarCombinationState = Constants.EMPTY_STRING;
        if (!action) {
            taskbarCombinationState = this._defaultService.getDefaultSetting(Constants.DEFAULT_TASKBAR_COMBINATION);
            if (taskbarCombinationState === Constants.TASKBAR_COMBINATION_NEVER)
                this.unMergeTaskBarButton();
            else if (taskbarCombinationState === Constants.TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS)
                this.mergeTaskBarButton();
        } else {
            const raiseEvent = false;
            taskbarCombinationState = (action === 'mergeTaskbar')
                ? Constants.TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS
                : Constants.TASKBAR_COMBINATION_NEVER;

            this._defaultService.updateDefaultData(Constants.DEFAULT_TASKBAR_COMBINATION, taskbarCombinationState, raiseEvent);
        }
    }

    // #endregion

    // #region Peek-show (temporary visibility)

    /**
     * Called from the desktop's mousemove handler when the taskbar is
     * hidden. If the cursor enters the bottom 5px gutter, show the
     * taskbar temporarily. If the cursor then leaves the bottom 40px
     * (taskbar height) band, hide it again.
     *
     * The vantaCntnr element is resolved via the component-supplied
     * `@ViewChild` ElementRef (§1.4 — was previously looked up via
     * `document.getElementById('vantaCntnr')`).
     *
     * The previous self-cancelling `setInterval(10ms)` helper was
     * removed in §2.x (~100 wake-ups/second for zero side effects); the
     * show/hide is fully driven by subsequent mousemove ticks calling
     * this method again.
     */
    showTaskBarTemporarily(evt: MouseEvent): void {
        // §1.4 — was `document.getElementById('vantaCntnr')`.
        const mainWindow = this._elements?.vantaCntnr.nativeElement;
        if (!mainWindow) return;

        const maxHeight = mainWindow.offsetHeight;
        const clientY = evt.clientY;
        const diff = (maxHeight - clientY);

        if (!this.isTaskBarTemporarilyVisible) {
            if (diff <= TaskbarMenuHandler.TMP_TASKBAR_DISPLAY_HEIGHT_PX) {
                // cursor is in the bottom 5px gutter while hidden — peek-show
                this.isTaskBarTemporarilyVisible = true;
                this._systemNotificationServices.showTaskBarNotify.next();
            }
        } else if (this.isTaskBarTemporarilyVisible) {
            if (diff <= TaskbarMenuHandler.TASKBAR_HEIGHT_PX) {
                // still hovering within the taskbar gutter — keep visible
                this.isTaskBarTemporarilyVisible = true;
            } else {
                // cursor left the gutter — hide again
                this.isTaskBarTemporarilyVisible = false;
                this._systemNotificationServices.hideTaskBarNotify.next();
            }
        }
    }

    // #endregion
}
