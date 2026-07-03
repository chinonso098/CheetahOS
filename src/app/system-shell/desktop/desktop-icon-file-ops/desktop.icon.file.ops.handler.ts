import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { dirname } from 'path';
import { ClipboardService } from 'src/app/application-services/clipboard.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { FileService } from 'src/app/shared/system-service/file.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';
import { GeneralMenu } from 'src/app/shared/system-ui-components/menu/menu.types';
import { ActivityType } from 'src/app/system-files/commons/common.enums';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';
import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { DesktopIconsHandler } from '../desktop-icons/desktop.icons.handler';
import { DesktopContextMenuHelper } from '../desktop.context.menu.helper';
import { DesktopStyleHelper } from '../desktop.style.helper';
import { DesktopRootElements } from '../desktop.types';
import { DialogMessage, DialogTitle } from 'src/app/shared/system-ui-components/dialog/dialog.types';


/**
 * Cross-cut callback the handler needs but cannot own. The state it
 * operates on lives on the component permanently:
 *   - `runApplication`  — launches a file's owning app via
 *                         `ProcessHandlerService`, plays the
 *                         navigation audio, tracks activity, and
 *                         resets the icon-selection styling on the
 *                         desktop. Stays on the component
 *                         permanently because it touches the
 *                         process/audio/history triad.
 *
 * §1.1.4.4 also routed `refresh` + `loadFiles` through this
 * interface; both retired in §1.1.4.5 once the icon list (`files`)
 * and the load/refresh implementations moved onto this handler.
 *
 * Wired once during `DesktopComponent.ngOnInit` via `init(callback)`.
 * Mirrors the §1.1.3.3 / §1.1.4.1 `init(...)` pattern.
 */
export interface DesktopIconFileOpsHandlerInit {
    runApplication: (file: FileInfo, overrideDefaultApp: boolean) => Promise<void>;
    /**
     * §1.4 — the desktop's singleton DOM elements (`@ViewChild`
     * ElementRefs bundled by the component).  Used to feed the icon
     * context-menu bounds helper (`checkAndHandleDesktopIconCntxtMenuBounds`)
     * and the invalid-chars tooltip / rename element lookups.
     */
    elements: DesktopRootElements;
}

/**
 * DesktopIconFileOps — per-icon context-menu + clipboard + shortcut
 * creation (§1.1.4.4) + file ops & icon list ownership (§1.1.4.5).
 *
 * Handler ownership:
 *   - Icon-context-menu state: `iconCntxtMenuStyle`,
 *     `showDesktopIconCntxtMenu`, `menuData`, `menuOrder`,
 *     `sourceData`, `dsktpMngrMenuOption`.
 *   - Currently-selected file: `selectedFile`, `propertiesViewFile`.
 *     PUBLIC because the iconsHandler still reaches into the icon
 *     list via the `getFiles` callback (component closure that now
 *     reads `iconFileOps.files`).
 *   - Icon list + directory (§1.1.4.5): `files`, `directory`.
 *     PUBLIC — the template's `*ngFor` and the component's
 *     `onDrop` bind to them directly.
 *   - Rename form + flags (§1.1.4.5): `renameForm`,
 *     `isRenameActive`, `currentIconName`, `invalidCharTimeOutId`.
 *   - User-prefs flags (§1.1.4.5): `confirmDelete`,
 *     `moveToRecycleBinOnDelete`.
 *   - Methods: ctx-menu / clipboard / shortcut (§1.1.4.4) plus
 *     `loadFiles`, `refresh`, `onDelete`, `removeDeletedFiles`,
 *     `onEmptyRecycleBin(+Helper)`, `onConfirmDelete`,
 *     `onDeleteMoveToRecycleBin`, the rename quartet
 *     (`onRenameFileTxtBoxShow/Save/Hide`, `onInputChange`,
 *     `isFormDirty`).
 *
 * Provided at the COMPONENT scope (in DesktopComponent.providers) for
 * consistency with the other §1.1 handlers. Sibling-injects
 * `DesktopIconsHandler` so it can call `executeIconClickTasks` when
 * opening the menu (right-click is just a different kind of click,
 * so it must update the selection bookkeeping the same way
 * left-click does) and so that `refresh` / rename can mutate
 * `currIconId` / `isIconInFocusDueToPriorAction` directly.
 *
 * The component re-points the iconsHandler's three rename/files
 * callbacks (`isFormDirty`, `getIsRenameActive`, `getFiles`) at
 * this handler during `ngOnInit` so iconsHandler stays unaware of
 * the migration — the closure boundary is the only thing that
 * changes for it.
 */
@Injectable()
export class DesktopIconFileOpsHandler {

    /**
     * `FileService`, `MenuService`, `DefaultService`, `AudioService`,
     * `ActivityHistoryService`, `UserNotificationService`,
     * `FormBuilder` are all root-provided (or globally instantiable)
     * so injecting them here is the same singleton the component
     * sees — no risk of state divergence.
     * `DesktopIconsHandler` is component-scoped (sibling) — Angular
     * resolves it from the same provider list, so we get the exact
     * handler instance the rest of the desktop already uses.
     */
    constructor(
        private readonly _fileService: FileService,
        private readonly _menuService: MenuService,
        private readonly _clipboardService: ClipboardService,
        private readonly _defaultService: DefaultService,
        private readonly _audioService: AudioService,
        private readonly _activityHistoryService: ActivityHistoryService,
        private readonly _userNotificationService: UserNotificationService,
        private readonly _formBuilder: FormBuilder,
        private readonly _iconsHandler: DesktopIconsHandler,
    ) {
        // Build the rename form eagerly so the template's
        // `[formGroup]="iconFileOps.renameForm"` binding is valid
        // from the very first change-detection pass — even before
        // `init()` runs. The form has a single nullable-empty input
        // control matching the original component setup.
        this.renameForm = this._formBuilder.nonNullable.group({
            renameInput: Constants.EMPTY_STRING,
        });
    }

    // #region Cross-cut wiring (component-supplied callback)

    

    /**
     * Default no-op shim so the handler is safe to call before
     * `init()` runs (e.g. unit tests). DesktopComponent's `ngOnInit`
     * supplies the real implementation before any user interaction
     * can reach the handler.
     */
    private _callbacks: DesktopIconFileOpsHandlerInit = {
        runApplication: async () => { /* set via init() */ },
        // §1.4 placeholder — the component replaces this with real
        // `@ViewChild` ElementRefs in `ngOnInit` (before any user
        // interaction can reach the handler).
        elements: {
            vantaCntnr: null!,
            desktopIconOl: null!,
            desktopIconCloneCntnr: null!,
            multiSelectPane: null!,
            invalidCharsToolTip: null!,
        },
    };

    /**
     * Wire the cross-cut callback. Must be called once during
     * `DesktopComponent.ngOnInit`. Order-independent with the other
     * handlers' `init` calls because this handler does NOT publish a
     * subject anything else subscribes to.
     */
    init(callbacks: DesktopIconFileOpsHandlerInit): void {
        this._callbacks = callbacks;
    }

    // #endregion

    // #region Menu state — public (bound from template)

    /** Inline style for the icon-context-menu (position + z-index). */
    iconCntxtMenuStyle: Record<string, unknown> = {};

    /** Visibility flag for the icon-context-menu. Bound from the
     *  template's `*ngIf` and reset to false by
     *  `hideDesktopContextMenuAndOthers` (still on the component). */
    showDesktopIconCntxtMenu = false;

    /** The visible menu rows after `adjustIconContextMenuData` has
     *  filtered the full `sourceData` down to the entries that apply
     *  to the right-clicked file. */
    menuData: GeneralMenu[] = [];

    /** Default = first-paint ordering. `adjustIconContextMenuData`
     *  may return a per-file override. */
    menuOrder = Constants.DEFAULT_MENU_ORDER;

    /** Menu rendering type — the file-manager variant. Constant; kept
     *  as a field (not a getter) so the template binding stays one
     *  property access. */
    dsktpMngrMenuOption = Constants.FILE_EXPLORER_FILE_MANAGER_MENU_OPTION;

    // #endregion

    // #region Selected file — public state (cross-handler reads)

    /**
     * The file the icon-context-menu is currently anchored to.
     * PUBLIC because rename (`onRenameFileTxtBoxShow/Save`) and
     * delete (`onDelete`) still on the component (§1.1.4.5) read it.
     * Marked `!` because it's set on every right-click; the menu is
     * never opened without a target.
     */
    selectedFile!: FileInfo;

    /**
     * Snapshot of `selectedFile` taken when the menu opens — passed
     * to the Properties dialog. The original code captured it
     * separately so a subsequent rename (which mutates `selectedFile`
     * in-place) couldn't desync the Properties view. Preserved as a
     * distinct field.
     */
    propertiesViewFile!: FileInfo;

    // #endregion

    // #region Source menu rows — public state

    /**
     * The full per-icon context-menu palette.
     * `adjustIconContextMenuData` is called with this AND the
     * right-clicked file; it returns the subset that applies (e.g.
     * "Empty Recycle Bin" only on the Recycle Bin folder). Built as
     * an instance field so each row's action callback can close
     * over `this` without manual binding.
     *
     * §1.1.4.5 collapsed the §1.1.4.4 `setFileOpsActions` bridge:
     * the Delete / Rename / Empty Recycle Bin / Confirm Delete /
     * Recycle on Delete rows now wire directly to this handler's
     * own methods (they migrated off the component).
     */
    sourceData: GeneralMenu[] = [
        { icon: Constants.EMPTY_STRING, label: MenuAction.OPEN, action: () => this.onTriggerRunApplication() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.OPEN_WITH, action: () => this.showOpenWithDialog() },
        { icon: `${Constants.IMAGE_BASE_PATH}recycle bin_folder_small.png`, label: MenuAction.EMPTY_RECYCLE_BIN, action: () => this.onEmptyRecycleBin() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.PIN_TO_QUICK_ACCESS, action: () => this.doNothing() },
        { icon: `${Constants.IMAGE_BASE_PATH}terminal.png`, label: MenuAction.OPEN_IN_TERMINAL, action: () => this.openInTerminal() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.PIN_TO_START, action: () => this.doNothing() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.PIN_TO_TASKBAR, action: () => this.pinIconToTaskBar() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.CUT, action: () => this.onCut() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.COPY, action: () => this.onCopy() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.CREATE_SHORTCUT, action: () => this.createShortCut() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.DELETE, action: () => this.onDelete() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.RENAME, action: () => this.onRenameFileTxtBoxShow() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.PROPERTIES, action: () => this.showPropertiesWindow() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.CONFIRM_DELETE, action: () => this.onConfirmDelete() },
        { icon: Constants.EMPTY_STRING, label: MenuAction.RECYCLE_ON_DELETE, action: () => this.onDeleteMoveToRecycleBin() },
    ];

    // #endregion

    // #region Icon list + working directory — public state (§1.1.4.5)

    /**
     * The desktop icon list. Bound from the template's `*ngFor`.
     * Migrated here from the component in §1.1.4.5 so all read/write
     * sites (`loadFiles`, `refresh`, delete, rename) sit together
     * with their owning data.
     */
    files: FileInfo[] = [];

    /**
     * Effective working directory for the desktop's file ops. Pinned
     * to `Constants.DESKTOP_PATH` — kept as a field (rather than
     * referencing the constant at every call site) for one-line
     * "what directory does the desktop manage?" introspection and to
     * give the component's `onDrop` a single property to read.
     */
    directory = Constants.DESKTOP_PATH;

    // #endregion

    // #region Rename form + flags — public/private state (§1.1.4.5)

    /**
     * Reactive form backing the in-place rename textbox. Built in
     * the constructor (so the template binding is valid on the
     * first paint). One control: `renameInput`.
     */
    renameForm: FormGroup;

    /**
     * True while a rename textbox is open on any icon. PUBLIC
     * because the icons-handler's `getIsRenameActive` callback was
     * re-pointed in §1.1.4.5 to read this directly via the closure
     * `() => this.iconFileOps.isRenameActive` in the component.
     */
    isRenameActive = false;

    /**
     * Name shown in the rename textbox at open time. Compared
     * against the post-edit value to detect "no change" (no rename
     * IO performed in that case). Private — only the rename
     * methods inside this handler need it.
     */
    private currentIconName = Constants.EMPTY_STRING;

    /**
     * Pending tooltip-hide timer id for the invalid-char tooltip.
     * Cleared on every keystroke so a stream of bad keys doesn't
     * pile up overlapping timers. Marked `!` because it's only ever
     * read inside the `if (invalidCharTimeOutId)` guard.
     */
    private invalidCharTimeOutId!: ReturnType<typeof setTimeout>;

    /**
     * Filename allow-list: alphanumerics, underscore, dot,
     * whitespace, hyphen. Anything else triggers the "invalid char"
     * tooltip. Single-source so the regex isn't recompiled on every
     * keystroke.
     */
    private readonly INVALID_CHARS_REGEX = /^[a-zA-Z0-9_.\s-]+$/;

    /**
     * Auto-hide delay (ms) for the invalid-char tooltip. Mirrors
     * the original `SECONDS_DELAY[0]` (6000ms) from the component.
     */
    private readonly INVALID_CHARS_TOOLTIP_DELAY_MS = 6000;

    // #endregion

    // #region User-prefs flags (§1.1.4.5)

    /**
     * "Show delete-confirmation dialog?" toggle. Surfaced on the
     * context menu via the `Confirm Delete` row; persisted to
     * defaults whenever it's flipped.
     */
    confirmDelete = true;

    /**
     * "Move to recycle bin on delete?" toggle. Surfaced on the
     * context menu via the `Recycle on Delete` row; persisted to
     * defaults whenever it's flipped (separate key from
     * `confirmDelete` — see the BUGFIX comment inside
     * `onDeleteMoveToRecycleBin`).
     */
    moveToRecycleBinOnDelete = true;

    // #endregion

    // #region Audio assets (§1.1.4.5)

    /**
     * Played on Empty-Recycle-Bin. Owned here because only the
     * file-ops handler triggers it. `cheetahNavAudio` stays on the
     * component because it's used by `runApplication` (which stays
     * on the component).
     */
    private readonly emptyTrashAudio = `${Constants.AUDIO_BASE_PATH}cheetah_recycle.wav`;

    // #endregion

    // #endregion

    // #region Constants

    /**
     * Delay between resetting the prior menu state and painting a new
     * one. Originally `DESKTOP_MENU_DELAY` on the component; kept here
     * because only this handler's `onShowDesktopIconCntxtMenu` uses
     * it. The other component-side `DESKTOP_MENU_DELAY` consumers
     * (taskbar menu surfaces) reference their own copy on the
     * component.
     */
    private readonly DESKTOP_MENU_DELAY = 250; //250ms

    // #endregion

    // #region Public methods

    /**
     * Right-click handler bound from the per-icon template. Routes
     * through the icons-handler's `executeIconClickTasks` so the
     * selection bookkeeping (curr/prev icon ids, marked-buttons set,
     * style updates) is identical to a left-click — only the
     * downstream action differs.
     *
     * Sequence preserved verbatim:
     *   1) preventDefault / stopPropagation
     *   2) selection bookkeeping
     *   3) sleep DESKTOP_MENU_DELAY (lets the prior menu reset
     *      propagate before painting the new one)
     *   4) compute filtered menu + ordering from `sourceData`
     *   5) capture `selectedFile` + `propertiesViewFile`
     *   6) flip visibility + compute position
     *
     * `menuHeight` heuristic note preserved: file rows render shorter
     * than folder rows; this should become dynamic later (§1.6).
     */
    async onShowDesktopIconCntxtMenu(evt: MouseEvent, file: FileInfo, id: number): Promise<void> {
        evt.stopPropagation();
        evt.preventDefault();

        // show IconContexMenu is still a btn click, just a different type
        this._iconsHandler.executeIconClickTasks(id);
        await CommonFunctions.sleep(this.DESKTOP_MENU_DELAY);

        const menuHeight = (file.getIsFile) ? 253 : 337; //this is not ideal.. menu height should be gotten dynmically
        // Read the two recycle-bin toggle booleans here (handler owns the
        // DefaultService dependency); helper stays pure / service-agnostic.
        const recycleBinState = {
            showDelete: this.readBoolDefault(Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG),
            moveToRecycle: this.readBoolDefault(Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE),
        };

        // Update the "Open" row's icon to the file's associated app.
        const openImg = this._fileService.getAppAssociaton(file.getOpensWith);
        this.sourceData.forEach(row => { if (row.label === MenuAction.OPEN) row.icon = openImg; });
        
        const result = DesktopContextMenuHelper.adjustIconContextMenuData(file, this.sourceData, recycleBinState);
        this.menuData = result[0];
        this.menuOrder = result[1];

        this.selectedFile = file;
        this.propertiesViewFile = file;
        this.showDesktopIconCntxtMenu = true;

        // Desktop owns every menu it renders; register so opening another menu
        // (or right-clicking empty desktop) closes this one.
        this._menuService.openContextMenu(Constants.DESKTOP);

        // §1.4 — pass the desktop root ElementRef.nativeElement so the
        // helper doesn't have to `document.getElementById('vantaCntnr')`.
        const axis = DesktopContextMenuHelper.checkAndHandleDesktopIconCntxtMenuBounds(evt, menuHeight, this._callbacks.elements.vantaCntnr.nativeElement);
        this.iconCntxtMenuStyle = {
            'position': 'absolute',
            'transform': `translate(${String(evt.clientX + 2)}px, ${String(axis.yAxis)}px)`,
            'z-index': Constants.Z_INDEX_DESKTOP_ICON_CONTEXT_MENU,
        };
    }

    /**
     * "Open" menu row — forwards to the component's `runApplication`
     * because launching processes is desktop-orchestration (audio,
     * activity history, process service, post-launch icon reset).
     */
    onTriggerRunApplication(): void {   
        const overrideDefaultApp = false; // "Open" uses the file's current preferred app, not a new one
        this._callbacks.runApplication(this.selectedFile, overrideDefaultApp);
    }


    /**
     * "Open with..." menu row — shows the app-selection dialog, then
     * launches the selected application with the current file.
     * @returns 
     */
    async showOpenWithDialog(): Promise<void> {
        if(this.selectedFile.getFileExtension === Constants.EMPTY_STRING) return;

        const opensWith = this._fileService.getOpensWith(this.selectedFile.getFileExtension);
        const selectedApplication = await this._userNotificationService.showApplicationSelectionNotification(opensWith);
        if(!selectedApplication) return; // user cancelled the app selection dialog

        //prefered app for the file extension is set to the selected application 
        // and the file is opened with the selected application
        this.selectedFile.setOpensWith = selectedApplication;
        const overrideDefaultApp = true;
        this._callbacks.runApplication(this.selectedFile, overrideDefaultApp);
    }

    /**
     * "Properties" menu row — fires the menu-service subject the
     * Properties view subscribes to. Uses the snapshot
     * `propertiesViewFile` (not `selectedFile`) so a concurrent
     * rename can't desync the Properties dialog with what was
     * right-clicked.
     */
    showPropertiesWindow(): void {
        this._menuService.showPropertiesView.next(this.propertiesViewFile);
    }

    /**
     * Placeholder for menu rows that haven't been wired to a real
     * action yet (Pin to Quick access / Pin to Start). Preserved
     * verbatim — log + no-op.
     */
    doNothing(): void {
        console.log('do nothing called');
    }

    /**
     * "Open in Terminal" menu row — launch the terminal app pointed at
     * the selected folder. Only valid for directories; files are
     * rejected (a terminal has no meaning for a single file).
     */
    async openInTerminal(): Promise<void> {
        const terminal = 'terminal';
        const selectedFile = this.selectedFile;

        if (selectedFile.getIsFile) {
            console.warn('Cannot open file in Terminal');
            return;
        }
        selectedFile.setOpensWith = terminal;
        const overrideDefaultApp = false;
        this._callbacks.runApplication(selectedFile, overrideDefaultApp);
    }

    // #endregion

    // #region Clipboard

    /**
     * "Copy" — stash the selected file's path + the COPY action in
     * the menu-service's store. The matching `onPaste` (here or any
     * other surface, e.g. file explorer) reads them back out.
     *
     * Preserved comment: "##Handle Multiple files" — multi-select
     * copy is not yet implemented; only the single `selectedFile` is
     * staged. Same for `onCut` / `onPaste`.
     */
    onCopy(): void { //##Handle Multiple files
        const action = MenuAction.COPY;
        const path = this.selectedFile.getCurrentPath;
        this._menuService.setStoreData([path, action]);
        this._clipboardService.addFileEntry(this.selectedFile, action);
    }

    /** Mirror of `onCopy` with the CUT action. */
    onCut(): void { //##Handle Multiple files
        const action = MenuAction.CUT;
        const path = this.selectedFile.getCurrentPath;
        this._menuService.setStoreData([path, action]);
        this._clipboardService.addFileEntry(this.selectedFile, action);
    }

    /**
     * "Paste" — read the staged path + action from the menu-service,
     * then either copy or move into the desktop directory. The 50ms
     * sleep gives file-service subjects a tick to settle before the
     * refresh pass picks up the new file.
     *
     * Special-case (preserved): a CUT originating from the file
     * explorer fires a cross-window notification (`dirFilesUpdateNotify`)
     * so the source view also refreshes. The branching is preserved
     * verbatim even though both branches end in the same `refresh` —
     * the original made the extra `addEventOriginator` + `next` calls
     * conditional, and matching that behaviour avoids spurious file
     * explorer refresh storms when pasting from the desktop itself.
     */
    async onPaste(): Promise<void> { //##Handle Multiple files
        const cntntPath = this._menuService.getPath();
        const action = this._menuService.getActions();
        const delay = 50; //50ms

        // console.log(`path: ${cntntPath}`);
        // console.log(`action: ${action}`);
        //onPaste will be modified to handle cases such as multiselect, file or folder or both

        if (action === MenuAction.COPY) {
            const result = await this._fileService.copyAsync(cntntPath, Constants.DESKTOP_PATH);
            if (result) {
                await CommonFunctions.sleep(delay);
                await this.refresh();
            }
        }
        else if (action === MenuAction.CUT) {
            const result = await this._fileService.moveAsync(cntntPath, Constants.DESKTOP_PATH);
            if (result) {
                if (cntntPath.includes(Constants.FILE_EXPLORER)) {
                    this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
                    this._fileService.dirFilesUpdateNotify.next();

                    await CommonFunctions.sleep(delay);
                    await this.refresh();
                } else {
                    await CommonFunctions.sleep(delay);
                    await this.refresh();
                }
            }
        }
    }

    /**
     * "Pin to Taskbar" — fires the menu-service subject the taskbar
     * pinning logic subscribes to.
     */
    pinIconToTaskBar(): void {
        this._menuService.pinToTaskBar.next(this.selectedFile);
    }

    // #endregion

    // #region Shortcut creation

   /**
     * "Create shortcut" — build a `.url` `FileInfo` whose content is
     * a Windows-style InternetShortcut INI block, write it to the
     * desktop directory, then reload the icon list so the new
     * shortcut appears. Preserved verbatim.
     */
    async createShortCut(inputFile?:FileInfo): Promise<void> {
        let fileContent = Constants.EMPTY_STRING;
        const requestID = CommonFunctions.generateID(8);
        const tmpFile: FileInfo = new FileInfo();

        if(inputFile) // the inputFile is passed from the dialog (cannot be a shortcut)
        {
            const isShortcut = false; // the inputFile is not a shortcut, it is the original file
            const isApp = true;
            fileContent = this.createShortCutHelper(inputFile, isShortcut, isApp);
            tmpFile.setStringBuffer = fileContent;
            tmpFile.setFileName = `${inputFile.getFileName}${Constants.URL}`;
        }
        else if(this.selectedFile){ // the selectedFile is used when the user right clicks on a file and selects create shortcut. can be a shortcut or a file

            fileContent = this.createShortCutHelper(this.selectedFile, this.selectedFile.getIsShortCut);
            tmpFile.setStringBuffer = fileContent;
            tmpFile.setFileName =`${this.selectedFile.getFileName}${Constants.URL}`;
        }

        const result = await this._fileService.writeFileAsync(Constants.DESKTOP_PATH, tmpFile, requestID);
        if (result) {
            // await this.loadFiles();

            const trueName = this._fileService.getFileOrFolderNameByRequestId(requestID);
            const srcPath = `${Constants.DESKTOP_PATH}/${trueName}`;
            const shortCut = await this._fileService.getFileInfoAsync(srcPath);
            shortCut.setFileName = trueName.replace(Constants.URL, Constants.EMPTY_STRING);
        
            this.files.push(shortCut);
        }
    }

    /**
     * Format the InternetShortcut INI block for a given file. The
     * `ContentPath` line picks the file's `getContentPath` for files
     * (the actual blob) vs `getCurrentPath` for folders (the
     * resolvable path) — preserved as it was.
     */
    createShortCutHelper(file: FileInfo, isShortcut: boolean = false, isApp: boolean = false): string {
        let fileContent = Constants.EMPTY_STRING;

        fileContent = `[InternetShortcut]
FileName=${file.getFileName}
IconPath=${file.getIconPath}
FileType=${file.getFileExtension}
ContentPath=${this.getShortCutContent(file, isShortcut, isApp)}
OpensWith=${file.getOpensWith}
`;
        return fileContent;
    }


    getShortCutContent(file: FileInfo, isShortcut: boolean, isApp: boolean): string {
        if(isApp){
            return Constants.EMPTY_STRING;
        }else{
            const contentPath = isShortcut 
                ? file.getContentPath 
                : (file.getIsFile) ? file.getCurrentPath || file.getContentPath : file.getCurrentPath

            return contentPath;
        }
    }

    // #endregion

    // #region File loading + soft refresh (§1.1.4.5)

    /**
     * Pure list reload: re-read the desktop directory from the
     * file service and swap `files` to the fresh result.
     *
     * Preserved behaviour: don't pre-empty `files` before the
     * await. The earlier component-side version assigned
     * `this.files = []` synchronously, which gave Angular change
     * detection a chance to render an empty desktop for one or
     * more frames before the new list arrived — visible flicker
     * on every refresh/paste/drop. Assigning only after the await
     * keeps the previous icon set on screen until the new one is
     * ready, and as a bonus, if `loadDirectoryFiles` throws we
     * keep the stale-but-valid view instead of wiping the desktop
     * to blank.
     */
    async loadFiles(): Promise<void> {
        this.files = await this._fileService.loadDirectoryFiles(this.directory);
    }

    /**
     * Add a file to the in-memory `files` list.
     * @param file The file to add.
     */
    addFileToFiles(file: FileInfo): void {
        this.files.push(file);
    }

    /**
     * Refresh entry-point: either a "true" reload (round-trip
     * through the file service) or a soft visual refresh (clear
     * + re-push the same array, with a short async gap so Angular
     * notices the reference change and re-runs the *ngFor diff).
     *
     * Always clears the icons-handler's "kept-focus from a prior
     * action" flag so the new render starts from a clean
     * selection state.
     *
     * `trueRefresh` defaults to true to match the original
     * component signature; the icons-handler passes `false`
     * when it just wants the in-memory (x,y) positions to repaint
     * after auto-arrange / auto-align rewrote them.
     */
    async refresh(trueRefresh = true): Promise<void> {
        this._iconsHandler.isIconInFocusDueToPriorAction = false;

        if (trueRefresh) {
            await this.loadFiles();
        } else {
            const delay = 25;
            let tmpFiles: FileInfo[] = [];

            tmpFiles.push(...this.files);
            this.files = [];

            await CommonFunctions.sleep(delay);
            this.files.push(...tmpFiles);
            tmpFiles = [];
        }
    }

    // #endregion

    // #region Delete / Recycle Bin (§1.1.4.5)

    /**
     * Delete the currently-selected icon(s). If multiple icons are
     * highlighted, delete them all; otherwise delete just
     * `selectedFile`. Concurrent deletion via `Promise.all` —
     * `deleteAsync` itself handles the confirm-delete dialog (only
     * for the first file via `skipConfirmDialog: i > 0`) and the
     * file-in-use safety check.
     *
     * On full success, removes the deleted entries from the
     * in-memory `files` list (avoids a full directory reload) and
     * either clears drag staging (multi-select branch) or resets
     * the menu store (single-file branch).
     */
    async onDelete(): Promise<void> {
        const isAlreadyInRecycleBin = false;

        // Determine which files to delete
        const filesToDelete = (this._iconsHandler.areMultipleIconsHighlighted)
            ? this._iconsHandler.markedBtnIds.map(id => this.files[Number(id)])
            : [this.selectedFile];

        // Run deletions concurrently — the service handles confirm-delete (first file only) and file-in-use checks
        const results = await Promise.all(
            filesToDelete.map((f, i) => this._fileService.deleteAsync(f.getCurrentPath, f.getIsFile, isAlreadyInRecycleBin,
                { file: f, skipConfirmDialog: i > 0 }
            ))
        );

        // If all deletions succeeded
        if (results.every(Boolean)) {
            this.removeDeletedFiles(filesToDelete);

            if (this._iconsHandler.areMultipleIconsHighlighted) {
                this._fileService.removeDragAndDropFile();
            } else {
                this._menuService.resetStoreData();
            }
        }
    }

    /**
     * Drop the deleted entries from the in-memory icon list. Match
     * by (name, path) tuple — same-named files in different folders
     * are distinct, and the desktop can hold both via shortcuts.
     *
     * §3.C — was O(n·m): for each kept file, walked every deleted
     * file via `.some(...)`.  Now O(n+m): build a `Set` of
     * `${name}|${path}` keys from `deletedFiles` once, then filter
     * `this.files` against the Set in a single pass.  Keeps the
     * (name, path) tuple semantics unchanged.
     */
    removeDeletedFiles(deletedFiles: FileInfo[]): void {
        if (deletedFiles.length === 0) return;
        const deletedKeys = new Set<string>(
            deletedFiles.map(d => `${d.getFileName}|${d.getCurrentPath}`),
        );
        this.files = this.files.filter(file =>
            !deletedKeys.has(`${file.getFileName}|${file.getCurrentPath}`),
        );
    }

    /**
     * "Empty Recycle Bin" menu row. Counts the bin first so we can
     * adapt the confirmation: a single item skips the confirm
     * dialog entirely (the per-file confirm inside `deleteAsync`
     * suffices), while 2+ items raise a "permanently delete N
     * items?" warning.
     */
    async onEmptyRecycleBin(): Promise<void> {
        const count = await this._fileService.countFolderItems(Constants.RECYCLE_BIN_PATH);

        if (count === 1)
            await this.onEmptyRecycleBinHelper();

        else if (count > 1) {
            const title = DialogTitle.FILE_SVC_DELETE_MULTIPLE_ITEMS;
            const msg = DialogMessage.FILE_SVC_DELETE_MULTIPLE_ITEMS.replace(DialogMessage.placeholder, `${count}`);
            const confirmed = await this._userNotificationService.showWarningNotification(msg, title);

            if (confirmed)
                await this.onEmptyRecycleBinHelper();
        }
    }

    /**
     * "Confirm Delete" menu row — toggle the show-confirmation
     * pref and persist. `raiseEvent: false` because the only
     * subscriber to `defaultSettingsChangeNotify` we care about
     * for this key is the file service's internal reader, and it
     * picks up the new value lazily.
     */
    onConfirmDelete(): void {
        this.confirmDelete = !this.confirmDelete;
        const raiseEvent = false;

        const confirmationState = (this.confirmDelete) ? Constants.TRUE : Constants.FALSE;
        this._defaultService.updateDefaultData(Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG, confirmationState, raiseEvent);
    }

    /**
     * "Recycle on Delete" menu row — toggle the move-to-recycle
     * pref and persist.
     *
     * BUGFIX (preserved from §1.1.4.5 pre-migration): this method
     * previously wrote to `DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG`,
     * which is the key owned by `onConfirmDelete()`. Toggling
     * "Recycle on delete" silently overwrote the user's "Confirm
     * delete" preference. Each toggle must persist to its own key.
     */
    onDeleteMoveToRecycleBin(): void {
        this.moveToRecycleBinOnDelete = !this.moveToRecycleBinOnDelete;
        const raiseEvent = false;

        const moveToRecycleBinState = (this.moveToRecycleBinOnDelete) ? Constants.TRUE : Constants.FALSE;
        this._defaultService.updateDefaultData(Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE, moveToRecycleBinState, raiseEvent);
    }

    /**
     * Reads a `DEFAULT_*` setting from `DefaultService` and reduces it
     * to a boolean using the `Constants.TRUE` sentinel.  Replaces the
     * old private `getConfirmDeleteState` helper that used to live in
     * `DesktopContextMenuHelper` (§1.1.5: pure-helper rule — the
     * helper no longer touches services, the handler does the read).
     */
    private readBoolDefault(key: string): boolean {
        return this._defaultService.getDefaultSetting(key) === Constants.TRUE;
    }

    /**
     * Actually empty the recycle bin: play the audio cue, ask the
     * file service to delete the bin root (folder, already-in-bin
     * flag set so the service short-circuits the per-file confirm),
     * then on success reset the menu store and reload the icon list.
     * The 50ms sleep lets file-service subjects settle before the
     * fresh load picks up the new state.
     */
    async onEmptyRecycleBinHelper(): Promise<void> {
        let result = false;
        const isAlreadyInRecycleBin = true;
        const isFile = false;
        const delay = 50; //50ms

        await this._audioService.play(this.emptyTrashAudio);
        result = await this._fileService.deleteAsync(Constants.RECYCLE_BIN_PATH, isFile, isAlreadyInRecycleBin);
        if (result) {
            this._menuService.resetStoreData();
            await CommonFunctions.sleep(delay);
            await this.loadFiles();
        }
    }

    // #endregion

    // #region Rename (§1.1.4.5)

    /**
     * Keystroke filter for the rename textbox. Accepts the
     * filename-safe character set; for anything else, raises the
     * invalid-char tooltip and schedules it to auto-hide.
     *
     * Special-cases Enter: prevents the textarea's newline and
     * forwards to `isFormDirty()` which acts as the form's
     * submit-or-cancel router.
     *
     * Returns `false` for invalid keys so the textarea swallows
     * the character (Angular's keydown contract).
     */
    onInputChange(evt: KeyboardEvent): boolean {
        if (this.invalidCharTimeOutId) {
            clearTimeout(this.invalidCharTimeOutId);
        }

        if (evt.key === 'Enter') {
            evt.preventDefault(); // prevent newline in textarea
            this.isFormDirty(); // trigger form submit logic
            return true;
        }

        // Non-printable keys (Backspace, Delete, Arrow*, Home, End, Tab,
        // Shift, Ctrl, etc.) all have multi-char `key` values, while every
        // printable character has `key.length === 1`.  Allow non-printables
        // through the textarea WITHOUT running the auto-grow / cursor-jump
        // helpers, because:
        //   • Bug fix — Backspace as a string ("Backspace") satisfies the
        //     `INVALID_CHARS_REGEX` whitelist (all letters), so it used to
        //     fall into the "valid" branch.  When the cursor sat at the
        //     end of a maxed-out line, `moveCursorToNextLine` would inject
        //     a fresh `\n` and bump the cursor by 1 right before the native
        //     Backspace removed that very `\n` — leaving value AND cursor
        //     unchanged.  Result: backspace appeared to be "stuck" at the
        //     line boundary forever.
        //   • The helpers are designed for the forward-typing path; they
        //     have no symmetric shrink/cursor-recovery logic on deletion
        //     or arrow navigation, so skipping them on non-printables is
        //     simply correct.
        else if (evt.key.length > 1) {
            return true;
        }

        else {
            const isValid = this.INVALID_CHARS_REGEX.test(evt.key);
            // §1.4 — feed the helper the invalid-chars tooltip ElementRef
            // (cached once per call) so it doesn't have to look it up via
            // `document.getElementById('invalidChars')` on every keystroke.
            const invalidCharsToolTipEl = this._callbacks.elements.invalidCharsToolTip.nativeElement;
            if (isValid) {
                DesktopStyleHelper.hideInvalidCharsToolTip(invalidCharsToolTipEl);
                //const inputElement = evt.target as HTMLInputElement;
                const elmntId = `renameTxtBox${this._iconsHandler.currIconId}`;

                if (CommonFunctions.shouldAutoResize(elmntId))
                    CommonFunctions.autoResize(elmntId);

                if (CommonFunctions.shouldMoveCursorToNextLine(elmntId))
                    CommonFunctions.moveCursorToNextLine(elmntId);

                return isValid;
            } else {
                DesktopStyleHelper.showInvalidCharsToolTip(this._iconsHandler.currIconId, invalidCharsToolTipEl);
                // hide after 6 secs
                this.invalidCharTimeOutId = setTimeout(() => DesktopStyleHelper.hideInvalidCharsToolTip(invalidCharsToolTipEl), this.INVALID_CHARS_TOOLTIP_DELAY_MS);
                return isValid;
            }
        }
    }

    /**
     * Submit-router for the rename form's `(ngSubmit)`. Dirty form
     * → commit (save). Pristine form → cancel and hide the textbox.
     *
     * Also invoked from `onInputChange` on Enter, since the
     * textarea swallows submit on Enter without it.
     *
     * NOTE: this used to require the pristine branch to fire TWICE
     * (a `renameFileTriggerCnt > 1` gate) before hiding. That was a
     * workaround from before the menu-component refactor: back then
     * the "Rename" menu click bubbled to the desktop's
     * `handleIconHighLightState` and would immediately close the
     * textbox the instant rename was selected, so the first pristine
     * trigger had to be absorbed. `MenuComponent.onMenuItemClick`
     * now calls `evt.stopPropagation()`, so the opening click never
     * reaches the desktop — the counter is obsolete and the textbox
     * hides on the first click-away.
     */
    isFormDirty(): void {
        if (this.renameForm.dirty) {
            this.onRenameFileTxtBoxDataSave();
        } else {
            this.onRenameFileTxtBoxHide();
        }
    }

    /**
     * Open the in-place rename textbox over the icon's caption:
     * flip the figure-caption / textbox visibility, prefill the
     * textbox with the current filename, auto-resize, focus +
     * select.
     *
     * Safety: bail if any of the three DOM elements is missing
     * (defensive; this fires from a click that just selected the
     * icon, so they should always exist).
     */
    onRenameFileTxtBoxShow(): void {
        this.isRenameActive = !this.isRenameActive;

        // §1.5 — dropped redundant `as HTML*` casts.
        // `getElementById` returns `HTMLElement | null`; we narrow to
        // `HTMLInputElement` only where we actually need the input-specific
        // surface (`.value` / `.focus()` / `.select()`).  The null-check
        // below preserves the original (slightly buggy) `&&` semantics:
        // see the latent comment-vs-code drift flagged for a later pass.
        const figCapElement = document.getElementById(`figCap${this._iconsHandler.currIconId}`);
        const renameContainerElement = document.getElementById(`renameContainer${this._iconsHandler.currIconId}`);
        const renameTxtBoxElement = document.getElementById(`renameTxtBox${this._iconsHandler.currIconId}`) as HTMLInputElement | null;
        DesktopStyleHelper.removeBtnStyle(this._iconsHandler.currIconId);

        if (!figCapElement && !renameContainerElement && !renameTxtBoxElement) return;

        // Non-null assertions below match the legacy `&&`-guard above:
        // when any element survives the guard the original code dereffed
        // unconditionally.  Preserved byte-for-byte so behaviour doesn't
        // change as part of the type-safety pass.
        figCapElement!.style.display = 'none';
        renameContainerElement!.style.display = 'block';

        renameTxtBoxElement!.style.display = 'block';
        renameTxtBoxElement!.style.zIndex = '3'; // ensure it's on top

        this.currentIconName = this.selectedFile.getFileName;
        this.renameForm.setValue({ renameInput: this.currentIconName });

        // Always run auto-resize on open, unconditionally.  Reasons:
        //   • The textarea has just transitioned from `display: none` to
        //     `display: block` and may still carry a stale inline height
        //     from a previous open, or be sitting at the CSS default
        //     `height: 20px; overflow: hidden` — both of which truncate
        //     long names and force the user to arrow-up to scroll.
        //   • The `shouldAutoResize` gate only inspects `lines[0].length`.
        //     A filename whose first line is < 11 chars but which spans
        //     multiple lines overall (possible when `moveCursorToNextLine`
        //     injected a literal `\n` that was later saved, since `\s` in
        //     `INVALID_CHARS_REGEX` permits it) would silently skip the
        //     resize and leave the textbox clipped.
        //   • The cost is a single scrollHeight read on open — negligible.
        const elmntId = `renameTxtBox${this._iconsHandler.currIconId}`;
        CommonFunctions.autoResize(elmntId);

        renameTxtBoxElement!.focus();
        renameTxtBoxElement!.select();
    }

    /**
     * Commit a rename. Validates the new text (non-empty,
     * different from current), asks the file service to rename
     * on disk, then on success patches the in-memory `FileInfo`
     * row in place so the desktop doesn't need a full reload to
     * show the new name. Activity history is tracked keyed on the
     * OLD path captured before mutation (otherwise the history
     * row would refer to the new path that didn't exist when the
     * rename was initiated).
     *
     * Preserved comment: //##. if rename successful, do not re-load
     */
    async onRenameFileTxtBoxDataSave(): Promise<void> { //##. if rename successful, do not re-load
        this.isRenameActive = !this.isRenameActive;
        const isRename = true;

        // §1.5 — dropped redundant `as HTMLElement` casts.
        const figCapElement = document.getElementById(`figCap${this._iconsHandler.currIconId}`);
        const renameContainerElement = document.getElementById(`renameContainer${this._iconsHandler.currIconId}`);
        // Strip newline chars from the candidate filename.  The textarea's
        // running value can contain literal `\n` chars because the
        // `CommonFunctions.moveCursorToNextLine` keystroke helper injects them
        // as a VISUAL line-break aid when the user crosses the per-line char
        // limit while typing.  Those `\n`s were never intended to be part of
        // the saved filename — and persisting them caused a data-loss bug:
        // after a browser refresh, the filename rendered through
        // `{{file.getFileName}}` with default `white-space: normal` had every
        // `\n` collapsed to whitespace, but the underlying filesystem path
        // (built as `${dirname}/${renameText}`) appeared truncated at the
        // first `\n` once reloaded, leaving the icon with only the first line
        // of the user's intended name and no way to recover the full text
        // (clicking can't expand text that's no longer there).
        //
        // Replacing with single spaces (not stripping outright) keeps the
        // word boundary the user typed so e.g. "abcdefghij" + auto-`\n` +
        // "klmnopqrst" remains "abcdefghij klmnopqrst", letting the icon's
        // `-webkit-line-clamp: 2` caption wrap naturally on the space.
        const renameText = (this.renameForm.value.renameInput as string).replace(/\n/g, ' ');
        const oldFileName = this.selectedFile.getFileName;
        // Capture BEFORE mutating selectedFile; activity history is keyed on
        // the path the row was originally stored under.
        const oldPath = this.selectedFile.getCurrentPath;

        // §4-S1 — SECURITY: re-validate the FINAL `renameText`
        // against the same character whitelist used by the
        // keystroke-time gate (`onInputChange` → `INVALID_CHARS_REGEX`).
        //
        // The keystroke gate only sees `KeyboardEvent.key` for printable
        // keydowns and is bypassed by:
        //   - paste (`Ctrl+V`, context-menu paste) — paste events are
        //     ClipboardEvents, not KeyboardEvents
        //   - drag-and-drop of text into the textarea
        //   - IME composition input
        //   - programmatic value injection (devtools / extensions)
        //
        // Without this re-check, a `renameText` containing `..`, `/`,
        // `\`, null byte, control chars, etc. flows straight into
        // `_fileService.renameAsync(path, renameText)`, which builds
        // `${dirname(path)}/${renameText}` — i.e. the user could
        // relocate the icon OUTSIDE its directory via the rename
        // action (path traversal).
        //
        // The validation BLOCKS the `renameAsync` call but lets the
        // rest of the method run normally so the textbox closes,
        // the figure-caption re-appears, and the icon returns to its
        // resting state.  Surfaces the same red invalid-chars tooltip
        // the keystroke path uses so the user sees WHY their input
        // was rejected.
        //
        // Note: empty string is treated as "no rename" (handled by
        // the existing `renameText !== EMPTY_STRING` guard below),
        // so we only fail the regex on a non-empty value.
        const isRenameTextSafe =
            renameText === Constants.EMPTY_STRING ||
            this.INVALID_CHARS_REGEX.test(renameText);
        if (!isRenameTextSafe) {
            if (this.invalidCharTimeOutId) {
                clearTimeout(this.invalidCharTimeOutId);
            }
            const invalidCharsToolTipEl =
                this._callbacks.elements.invalidCharsToolTip.nativeElement;
            DesktopStyleHelper.showInvalidCharsToolTip(
                this._iconsHandler.currIconId,
                invalidCharsToolTipEl,
            );
            this.invalidCharTimeOutId = setTimeout(
                () => DesktopStyleHelper.hideInvalidCharsToolTip(invalidCharsToolTipEl),
                this.INVALID_CHARS_TOOLTIP_DELAY_MS,
            );
        }

        if (isRenameTextSafe &&
            renameText !== Constants.EMPTY_STRING && renameText.length !== 0 && renameText !== this.currentIconName) {
            const result = await this._fileService.renameAsync(this.selectedFile.getCurrentPath, renameText, this.selectedFile.getIsFile,
                { file: this.selectedFile });

            if (result) {
                // renamFileAsync, doesn't trigger a reload of the file directory, so to give the user the impression that the file has been updated, the code below
                const fileIdx = this.files.findIndex(f => (dirname(f.getCurrentPath) === dirname(this.selectedFile.getCurrentPath)) && (f.getFileName === this.selectedFile.getFileName));
                this.selectedFile.setContentPath = renameText;
                this.selectedFile.setCurrentPath = `${dirname(this.selectedFile.getCurrentPath)}/${renameText}`;
                this.selectedFile.setFileName = renameText;
                this.selectedFile.setDateModified = Date.now().toString();
                this.files[fileIdx] = this.selectedFile; //## this line may not be needed.

                this.renameForm.reset();
                this._menuService.resetStoreData();
                //await this.loadFiles();
                const activity = CommonFunctions.getTrackingActivity(ActivityType.FILE, renameText, oldPath, oldFileName, isRename);
                CommonFunctions.trackActivity(this._activityHistoryService, activity);
            }
        }
        else {
            this.renameForm.reset();
        }

        DesktopStyleHelper.setBtnStyle(this._iconsHandler.currIconId, false, this._iconsHandler.currIconId, this._iconsHandler.isIconInFocusDueToPriorAction);

        if (!figCapElement || !renameContainerElement) return;

        figCapElement.style.display = 'block';
        renameContainerElement.style.display = 'none';
    }

    /**
     * Cancel/hide the rename textbox without committing. Restores
     * the figure caption visibility and re-asserts the
     * kept-focus-from-prior-action flag so the icon's selection
     * style persists after dismissal.
     */
    onRenameFileTxtBoxHide(): void {
        this.isRenameActive = !this.isRenameActive;

        // §1.5 — dropped redundant `as HTMLElement` casts.
        const figCapElement = document.getElementById(`figCap${this._iconsHandler.currIconId}`);
        const renameContainerElement = document.getElementById(`renameContainer${this._iconsHandler.currIconId}`);

        if (!figCapElement || !renameContainerElement) return;

        figCapElement.style.display = 'block';
        renameContainerElement.style.display = 'none';
        this._iconsHandler.isIconInFocusDueToPriorAction = true;
    }

    // #endregion
}
