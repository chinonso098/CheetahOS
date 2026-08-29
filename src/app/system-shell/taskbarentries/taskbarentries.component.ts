import { OnInit, AfterViewInit, Component } from '@angular/core';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { ComponentType } from 'src/app/system-files/system.types';

import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { IconAppCurrentState, RectLite, TaskBarIconInfo, TaskBarPreviewPositionInfo, TooltipPositionInfo } from './taskbar.entries.type';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { FileInfo } from 'src/app/system-files/fs/file.info';

/**
 * Lifecycle note (see /memories/repo/cheetahos-desktop-lifecycle.md):
 * TaskBarEntriesComponent is a singleton for the lifetime of the page — it is
 * never destroyed. Every `.subscribe(...)` in the constructor therefore lives
 * for the entire session; teardown is intentionally omitted (see the unified
 * comment in the constructor). DO NOT add `takeUntil(...)` teardown without
 * also revisiting how the component is reused across login/lock screens.
 */

@Component({
  selector: 'cos-taskbarentries',
  templateUrl: './taskbarentries.component.html',
  styleUrls: ['./taskbarentries.component.css'],
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('taskbarEntryAnim', [
      transition(':enter', [
        style({ width: '0px', opacity: 0, transform: 'translateX(-6px)' }),
        animate(
          '220ms cubic-bezier(.2,.9,.2,1)',
          style({ width: '*', opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
      transition(':leave', [
        style({ width: '*', opacity: 1, transform: 'translateX(0)' }),
        animate(
          '220ms cubic-bezier(.4,0,.8,.2)',
          style({ width: '0px', opacity: 0, transform: 'translateX(-6px)' })
        ),
      ]),
    ]),
  ],
})

export class TaskBarEntriesComponent implements OnInit, AfterViewInit {

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _processHandlerService!:ProcessHandlerService;
  private _systemNotificationService!:SystemNotificationService;
  private _menuService!:MenuService;
  private _windowServices!:WindowService;
  private _sessionManagementService!:SessionManagementService

  private prevOpenedProccesses:string[]= [];
  mergedTaskBarIconList:TaskBarIconInfo[] = [];
  unMergedTaskBarIconList:TaskBarIconInfo[] = [];
  pinnedTaskBarIconList:TaskBarIconInfo[] = [];
  sessionPinnedTaskbarIcons:TaskBarIconInfo[] = [];

  /** Delay (ms) before re-running the focus-highlight after a focus change. */
  private readonly HIGHLIGHT_DELAY_MS = 50;
  private readonly PREVIEW_W = 185;
  private readonly PREVIEW_GAP = 1; // whatever your CSS gap is between preview tiles

  readonly mergedIcons = Constants.MERGED_TASKBAR_ENTRIES;
  readonly unMergedIcons = Constants.DISTINCT_TASKBAR_ENTRIES;
 
  readonly hideLabel = 'hideLabel';
  readonly showLabel = 'showLabel';
  readonly tskbar = 'tskbar';
  readonly taskBarId = 'the-window-taskbar';

  readonly cheetahTskBarKey = 'cheetahTskBarKey';
  readonly pinAction = 'pin';
  readonly unPinAction = 'unPin';

  taskBarEntriesIconState = this.unMergedIcons;
  hideShowLabelState = this.showLabel;

  windowInFocusPid = 0;
  prevWindowInFocusPid = 0;
  isAnyWindowInFocus = false;
  
  hasWindow = false;
  icon =  `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  name = 'taskbarentry';
  processId = 0;
  type = ComponentType.System;
  displayName = Constants.EMPTY_STRING;

  /**
   * Convenience getter — `true` when the taskbar is rendering one merged icon
   * per application (vs. one icon per running window). Centralising the
   * comparison eliminates the dozen `=== this.mergedIcons` / `=== this.unMergedIcons`
   * checks previously sprinkled through the file, each of which was an
   * opportunity for a typo-based branching bug.
   */
  get isMergedMode(): boolean {
    return this.taskBarEntriesIconState === this.mergedIcons;
  }

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService, menuService:MenuService,
              triggerProcessService:ProcessHandlerService, windowServices:WindowService, systemNotificationService:SystemNotificationService,
              sessionManagementService:SessionManagementService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._processHandlerService = triggerProcessService;
    this._menuService = menuService;
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this._sessionManagementService = sessionManagementService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    /*
     * SUBSCRIPTION TEARDOWN POLICY
     *  The taskbar is a singleton for the session lifetime; the component is
     *  never destroyed (see /memories/repo/cheetahos-desktop-lifecycle.md).
     *  Every subscription below is therefore intentionally left un-managed —
     *  there is no `takeUntilDestroyed`, no Subscription bag, no `ngOnDestroy`
     *  cleanup. Do not add such teardown without first verifying the
     *  component will actually be destroyed (e.g. via OnDestroy probe), or
     *  the taskbar will silently stop reacting to system events.
     */

    // Running-process lifecycle.
    this._runningProcessService.processListChangeNotify.subscribe(() => this.updateRunningProcess());
    this._runningProcessService.closeProcessNotify.subscribe((p) => this.onCloseProcessNotify(p));

    // Context-menu actions originated from the taskbar app-icon menu.
    this._menuService.pinToTaskBar.subscribe((p) => this.onPinIconToTaskBarIconList(p));
    this._menuService.unPinFromTaskBar.subscribe((p) => this.onUnPinIconFromTaskBarIconList(p));
    this._menuService.openApplicationFromTaskBar.subscribe((p) => this.openApplication(p));
    this._menuService.closeApplicationFromTaskBar.subscribe((p) => this.closeApplication(p));
    this._menuService.UnMergeTaskBarIcon.subscribe(() => this.onChangeTaskBarIconState(this.unMergedIcons));
    this._menuService.mergeTaskBarIcon.subscribe(() => this.onChangeTaskBarIconState(this.mergedIcons));

    // App-driven icon/title updates (e.g. fileexplorer renames its window).
    this._systemNotificationService.taskBarIconInfoChangeNotify.subscribe((p) => this.updateTaskBarIcon(p));

    // Window-focus pipeline — three distinct events all funnel into the same
    // highlight re-run. We MUST capture the pid pair inside the closure passed
    // to setTimeout: if a second focus change arrives within HIGHLIGHT_DELAY_MS,
    // it would otherwise overwrite `this.prevWindowInFocusPid` before the first
    // timer fires, causing the wrong icon to be un-highlighted.
    this._windowServices.focusOnCurrentProcessWindowNotify.subscribe((p) => this.onFocusChange(p));
    this._windowServices.currentProcessInFocusNotify.subscribe((p) => this.onFocusChange(p));

    this._windowServices.noProcessInFocusNotify.subscribe(() => {
      // Capture the currently-focused pid for the un-highlight; same race
      // protection rationale as onFocusChange().
      const pidToClear = this.windowInFocusPid;
      this.isAnyWindowInFocus = false;
      this.removeHighlightFromTaskbarIcon(pidToClear);
    });
  }

  /**
   * Common handler for the two "a window is now focused" signals. Captures the
   * previous / new pid into a closure so that a follow-up focus event arriving
   * before the highlight timer fires cannot clobber the values the timer needs.
   */
  private onFocusChange(newPid: number): void {
    const prevPid = this.windowInFocusPid;
    this.prevWindowInFocusPid = prevPid;
    this.windowInFocusPid = newPid;
    this.isAnyWindowInFocus = true;

    setTimeout(() => {
      this.highlightTaskbarIcon(prevPid, newPid);
    }, this.HIGHLIGHT_DELAY_MS);
  }
  

  ngOnInit(): void {
    this.retrievePastSessionData();
    this.fetchPriorData();
  }

  ngAfterViewInit(): void {
    const delay = 1500; //1.5 secs
    //change detection is the better solution
    setTimeout(() => {
      this.setIconsBasedOnTaskbarMode();
    }, delay);
  }

  fetchPriorData():void{
    if(this.isMergedMode){
      this.mergedTaskBarIconList.push(...this.sessionPinnedTaskbarIcons);
    }else{
      this.unMergedTaskBarIconList.push(...this.sessionPinnedTaskbarIcons);
    }
  }

  updateRunningProcess():void{
    this.setIconsBasedOnTaskbarMode();
  }

  onCloseProcessNotify(process:Process):void{
    if(this.isMergedMode){
      this.updateMergedTaskbarIconListOnClose(process);
    }else{
      this.updateUnMergedTaskbarIconListOnClose(process);
    }
  }

  onPinIconToTaskBarIconList(file:FileInfo):void{
    const isMerged = this.isMergedMode;
    let tskbarFileInfo!:TaskBarIconInfo; 
    const tskBarIcons = isMerged ? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;

    if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith)){
      tskbarFileInfo = this.getTaskBarIconInfo(file,undefined);
      tskBarIcons.push(tskbarFileInfo);
      this.storeTskBarState(tskbarFileInfo, this.pinAction);
    }else{
      if(!tskBarIcons.some(x => x.opensWith === file.getOpensWith && x.isPinned)){
        const unPinnedIcon = tskBarIcons.find(x => x.opensWith === file.getOpensWith);
        if(unPinnedIcon){
          unPinnedIcon.isPinned = true;
          unPinnedIcon.isOtherPinned = true;

          this.storeTskBarState(unPinnedIcon, this.pinAction);

          if(!isMerged){
            tskBarIcons.forEach(item => {
              if (item.opensWith === unPinnedIcon.opensWith && item.pId !== unPinnedIcon.pId) {
                item.isOtherPinned = true;
              }
            });
          }
        }
      }
    }

    setTimeout(() => {
      this.highlightTaskbarIcon();
    }, this.HIGHLIGHT_DELAY_MS);
  }

  onUnPinIconFromTaskBarIconList(file:FileInfo):void{
    const isMerged = this.isMergedMode;
    const tskBarIcons = isMerged ? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;

    const pinnedIconIdx = tskBarIcons.findIndex( x => x.opensWith === file.getOpensWith && x.isPinned);

    if(pinnedIconIdx === -1) return;
    
    const pinnedIcon = tskBarIcons[pinnedIconIdx];
    pinnedIcon.isPinned = false;
    pinnedIcon.isOtherPinned = false;

    this.storeTskBarState(pinnedIcon, this.unPinAction);

    //update other instances of app, set isOtherPinned = false;
    if(!isMerged){
      tskBarIcons.forEach(item => {
        if (item.opensWith === pinnedIcon.opensWith && item.pId !== pinnedIcon.pId) {
          item.isOtherPinned = false;
        }
      });
    }

    //check if app is not running
    const isAppRunning = this._runningProcessService
      .getProcesses()
      .some(p=> p.getProcessName === file.getOpensWith);

    if(!isAppRunning){
      this.removeIconFromTaskBarIconList(0, file.getOpensWith, false);
    }
  }

  onChangeTaskBarIconState(iconState:string):void{
    this.taskBarEntriesIconState = iconState;
    this.pinnedTaskBarIconList = [];

    // When the user toggles modes we seed the *new* mode's "pending pinned"
    // bucket from the *previous* mode's list, so that pinned apps survive the
    // re-layout. `pinnedTaskBarIconList` is consumed lazily inside
    // `consumePendingPinnedFor()` as each process is re-handled below.
    if(this.isMergedMode){
      this.hideShowLabelState = this.hideLabel;
      this.pinnedTaskBarIconList.push(...this.unMergedTaskBarIconList.filter(x => x.isPinned));
    }else{
      this.hideShowLabelState = this.showLabel;
      this.pinnedTaskBarIconList.push(...this.mergedTaskBarIconList.filter(x => x.isPinned));
    }

    this.retriggerRunningProcess();
  }

  retriggerRunningProcess():void{
    this.setIconsBasedOnTaskbarMode();

    setTimeout(() => {
      this.highlightTaskbarIcon();
    }, this.HIGHLIGHT_DELAY_MS);
  }

  setIconsBasedOnTaskbarMode(): void {
    if (this.isMergedMode) {
      this.handleMergedTaskbarIcons();
    } else {
      this.handleUnmergedTaskbarIcons();
    }
  }

  handleUnmergedTaskbarIcons():void{
    const delay = 5; // 5 millisecs
    const proccesses = this.getProccessWithWindows()
    this.storeHistory(proccesses);

    for(const process of proccesses){
      const existingIcon = this.unMergedTaskBarIconList.find(i => i.opensWith === process.getProcessName);
      const isPinned = this.consumePendingPinnedFor(process.getProcessName);
      const isOtherPinned  = this.unMergedTaskBarIconList.some(x => x.opensWith === process.getProcessName && x.isPinned);
      const iconPath = this.checkForPriorIcon(process.getProcessId, process.getIcon);

      if(existingIcon){
        const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName)
        if(instanceCount === 1 && existingIcon.isPinned){
          this.updatePinnedTaskbarIconOnInit(process);
        }else if((instanceCount > 1) 
          && (!this.unMergedTaskBarIconList.find(i => i.opensWith === process.getProcessName && i.pId === process.getProcessId))){
          // add only unique instances
          const newIcon = this.getTaskBarIconInfo(undefined, process);
          newIcon.isPinned = isPinned;
          newIcon.isOtherPinned = isOtherPinned;
          newIcon.iconPath = iconPath;
          this.unMergedTaskBarIconList.push(newIcon);
        }
      }else{
        const newIcon = this.getTaskBarIconInfo(undefined, process);
        newIcon.isPinned = isPinned;
        // Use the freshly-computed `isOtherPinned` (consistent with the
        // multi-instance branch above), NOT `isPinned`. A brand-new icon never
        // has a sibling at the moment of insertion, so this evaluates to false
        // for the first instance and becomes true automatically when sibling
        // instances are added in subsequent loop iterations.
        newIcon.isOtherPinned = isOtherPinned;
        newIcon.iconPath = iconPath;
        this.unMergedTaskBarIconList.push(newIcon);
      }

      setTimeout(() => {this.setIconState(true, process.getProcessName, process.getProcessId);}, delay);
    }
    this.groupTaskBarIconsByOpensWithAndEntryOrder();
  }

  handleMergedTaskbarIcons():void{
    const delay = 5; // 5 millisecs
    const uniqueProccesses = this.getUniqueProccessWithWindows();
    this.storeHistory(uniqueProccesses);

    for(const process of uniqueProccesses){
      const isPinned = this.consumePendingPinnedFor(process.getProcessName);
      if(!this.mergedTaskBarIconList.some(i => i.opensWith === process.getProcessName)){
        const newIcon = this.getTaskBarIconInfo(undefined, process);
        newIcon.isPinned = isPinned;
        newIcon.isOtherPinned = isPinned;
        newIcon.instanceCount = 1;
        this.mergedTaskBarIconList.push(newIcon);
      }else{
        // increment instance counter
        //check to ensure that the pId and processname, aren't already in the list
        const tskBarIcon = this.mergedTaskBarIconList.find(i => i.opensWith === process.getProcessName);
        if(tskBarIcon){
          if(tskBarIcon.pId === 0){
            tskBarIcon.pId = process.getProcessId;
            tskBarIcon.instanceCount = tskBarIcon.instanceCount + 1;
          }else{
            const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName);
            tskBarIcon.instanceCount = instanceCount;
          }
        }
      }

      setTimeout(() => { this.setIconState(true, process.getProcessName);}, delay);
    }
  }

  /**
   * Re-order `unMergedTaskBarIconList` so that all entries sharing the same
   * `opensWith` (i.e. instances of the same app) are kept contiguous, while
   * preserving the *first-seen order* of each app group.
   *
   * Previously implemented as a hand-rolled two-pointer in-place swap; for the
   * realistic taskbar size (well under 50 entries) a `Map`-keyed stable sort
   * is both simpler and asymptotically equivalent. The behaviour is identical:
   * groups appear in the order their first member was inserted, and within a
   * group the relative order of instances is preserved (Array#sort is stable
   * in every modern engine).
   */
  groupTaskBarIconsByOpensWithAndEntryOrder():void{
    const firstSeenOrder = new Map<string, number>();
    for (const icon of this.unMergedTaskBarIconList) {
      if (!firstSeenOrder.has(icon.opensWith)) {
        firstSeenOrder.set(icon.opensWith, firstSeenOrder.size);
      }
    }
    this.unMergedTaskBarIconList.sort(
      (a, b) => firstSeenOrder.get(a.opensWith)! - firstSeenOrder.get(b.opensWith)!
    );
  }

  /**
   * Look up — and consume — any pending "pinned" record for `procName`.
   *
   * This method is intentionally **destructive**: it both *reports* whether a
   * pending pinned entry exists for the given process name AND removes it from
   * `pinnedTaskBarIconList` so it can never be re-applied twice. The previous
   * name (`checkIfIconWasPinned`) read like a pure query but actually mutated
   * state — the rename is purely a clarity fix.
   */
  consumePendingPinnedFor(procName:string):boolean{
    const originalLength = this.pinnedTaskBarIconList.length;
    this.pinnedTaskBarIconList = this.pinnedTaskBarIconList.filter(x => x.opensWith !== procName);
    return this.pinnedTaskBarIconList.length < originalLength;
  }

  checkForPriorIcon(pId:number, iconPath:string):string{
    const tmpInfo = this._systemNotificationService.getAppIconNotication(pId);
    if(tmpInfo.length > 0){
      const priorIcon = tmpInfo[1];
      return priorIcon;
    }
    return iconPath;
  }
  
  getUniqueProccessWithWindows():Process[]{
    const uniqueProccesses:Process[] = [];
    /**
     * filter first on processes that have windows
     * then select unique instance of process with same proccess name
     */
    this._runningProcessService.getProcesses()
      .filter(p => p.getHasWindow == true)
      .forEach(x =>{
        if(!uniqueProccesses.some(a => a.getProcessName === x.getProcessName)){
          uniqueProccesses.push(x);
        }
    });

    return uniqueProccesses
  }

  getProccessWithWindows():Process[]{
    /**
     * filter first on processes that have windows
     */
    return this._runningProcessService.getProcesses().filter(p => p.getHasWindow == true);
  }

  storeHistory(arg:Process[]):void{
    arg.forEach(x =>{
      if(!this.prevOpenedProccesses.includes(x.getProcessName)){
        this.prevOpenedProccesses.push(x.getProcessName);
      }
    });
  }

  /**
   * Locate an icon in the *currently active* list (merged vs. unmerged) given
   * a process identity. Centralising this lookup means the highlight code
   * doesn't have to repeat the (mode → list → key) decision tree at every
   * call site.
   *
   * - In merged mode, an icon represents *all* instances of an app, so we key
   *   on `opensWith` only.
   * - In unmerged mode, each icon represents one window, so we key on the
   *   `(opensWith, pId)` pair.
   */
  private findIconByProcess(opensWith: string, pId: number): TaskBarIconInfo | undefined {
    if (this.isMergedMode) {
      return this.mergedTaskBarIconList.find(i => i.opensWith === opensWith);
    }
    return this.unMergedTaskBarIconList.find(i => i.opensWith === opensWith && i.pId === pId);
  }

  /**
   * Drop the `isFocused` / `isTransferActive` flags for whichever icon owns the
   * given pid. Quietly no-ops when the pid is 0/undefined or doesn't resolve
   * to a process (e.g. it was already closed).
   */
  private clearFocusFor(pid: number | undefined): void {
    if (pid === undefined || pid === 0) return;
    const process = this._runningProcessService.getProcess(pid);
    if (!process) return;
    const icon = this.findIconByProcess(process.getProcessName, process.getProcessId);
    if (!icon) return;
    icon.isFocused = false;
    icon.isTransferActive = false;
  }

  /**
   * Hard-reset the focus/transfer highlight on EVERY icon in BOTH lists.
   *
   * Only one window can be focused at a time, so at most one icon may carry
   * `isFocused`. `clearFocusFor(pid)` alone can't guarantee that: it clears a
   * single, known pid in the *active* list. When the user toggles merged ⇄
   * unmerged, a stale `isFocused` left on the now-inactive list survives the
   * switch, and on switching back two different apps could end up highlighted.
   * Clearing both lists wholesale before re-applying the current focus makes
   * the highlight idempotent and impossible to double up.
   */
  private clearAllFocusFlags(): void {
    for (const icon of this.mergedTaskBarIconList) {
      icon.isFocused = false;
      icon.isTransferActive = false;
    }
    for (const icon of this.unMergedTaskBarIconList) {
      icon.isFocused = false;
      icon.isTransferActive = false;
    }
  }

  /**
   * Mark an icon as "this app is running with at least one window".
   *
   * Historically this method wrote `borderBottomColor` directly to the DOM
   * (because the icon list was rendered before its `isRunning` flag had a
   * chance to drive a CSS class). With the template now binding
   * `[class.is-active]="app.isRunning"` directly we just mutate the model and
   * let Angular update the DOM during the next change-detection pass.
   */
  setIconState(isActive: boolean, opensWith: string, pId?: number): void {
    const icon = this.findIconByProcess(opensWith, pId ?? 0);
    if (!icon) return;
    icon.isRunning = isActive;
    if (!isActive) {
      // Clearing the active flag also clears any stale focus highlight that
      // belonged to the now-closed window.
      icon.isFocused = false;
      icon.isTransferActive = false;
    }
  }

  /**
   * Compute the running flag and the show/hide-label flag for a given app
   * file or process under the current taskbar mode.
   *
   * The label visibility rule collapses to a single condition:
   *     show the label ⇔ (mode is unmerged) ∧ (the app is running).
   * In every other combination the label is hidden, which is why the previous
   * 4-branch if/else cascade contained two dead branches and one duplicate.
   */
  getAppCurrentState(file?:FileInfo, process?:Process):IconAppCurrentState{
    let isRunning = false;
    if(file){
      isRunning = this._runningProcessService.getProcesses()
        .some(p => p.getProcessName === file.getOpensWith);
    }else if(process){
      isRunning = this._runningProcessService.getProcesses()
        .some(p => p.getProcessName === process.getProcessName);
    }

    const showLabel = (!this.isMergedMode && isRunning) ? this.showLabel : this.hideLabel;
    return { isRunning, showLabel };
  }

  updatePinnedTaskbarIconOnInit(process:Process):void{
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarIconList.findIndex(x => x.uId === tmpUid);
    const tskBarIcon = this.unMergedTaskBarIconList[idx];

    if(tskBarIcon){
      //check if an instance of this apps is running
      const isRunning = this._runningProcessService
        .getProcesses()
        .some( p=> p.getProcessName === process.getProcessName);

      tskBarIcon.uId =  `${process.getProcessName}-${process.getProcessId}`; 
      tskBarIcon.pId = process.getProcessId;
      tskBarIcon.isRunning = isRunning;
      tskBarIcon.showLabel = this.showLabel;
      tskBarIcon.isPinned = true;
      tskBarIcon.isOtherPinned = true;
    }
  }

  updateUnMergedTaskbarIconListOnClose(process:Process):void{
    const uId = `${process.getProcessName}-${process.getProcessId}`;
    const tmpUid = `${process.getProcessName}-0`;
    const idx = this.unMergedTaskBarIconList.findIndex(x => x.uId === uId);
    const delay = 5; //5ms

    if(idx === -1) return;

    const tskBarIcon = this.unMergedTaskBarIconList[idx];

    if (!tskBarIcon) return;

    // if the instace that was closed, was the pinned instance
    if(tskBarIcon.isPinned){      
      //check if an instance of this apps is running, and update the pinned instance with it's info
      const isAppRunning = this._runningProcessService
        .getProcesses()
        .some(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pId);

      if(isAppRunning){
        //update the pinned instace to point to one of the similar running instace
        const alternateProcess = this._runningProcessService
        .getProcesses()
        .find(p=> p.getProcessName === process.getProcessName && p.getProcessId !== tskBarIcon.pId);

        if(alternateProcess){
          const replacementIcon = this.unMergedTaskBarIconList.find(x => x.pId === alternateProcess.getProcessId);

          if(replacementIcon){
            this.removeIconFromTaskBarIconList(alternateProcess.getProcessId, Constants.EMPTY_STRING, true);
            replacementIcon.isPinned = true;      
            this.unMergedTaskBarIconList[idx] = replacementIcon;
          }
        }
      }else{
        tskBarIcon.uId = tmpUid;
        tskBarIcon.pId = 0;
        tskBarIcon.isRunning = isAppRunning;
        tskBarIcon.showLabel = this.hideLabel;
        tskBarIcon.iconPath = tskBarIcon.defaultIconPath;
        tskBarIcon.displayName = tskBarIcon.opensWith;

        setTimeout(() => {
          this.setIconState(false,tskBarIcon.opensWith,tskBarIcon.pId);
        }, delay);
      }
    }else if(!tskBarIcon.isPinned){
      this.removeIconFromTaskBarIconList(process.getProcessId, Constants.EMPTY_STRING, true);
    }
  }

  updateMergedTaskbarIconListOnClose(process:Process):void{
    const idx = this.mergedTaskBarIconList.findIndex(x => x.opensWith === process.getProcessName);
    const delay = 5; //5ms

    if(idx === -1) return;

    const tskBarIcon = this.mergedTaskBarIconList[idx];
    if (!tskBarIcon) return;

    const isAppRunning = this._runningProcessService
      .getProcesses()
      .some(p => p.getProcessName === process.getProcessName);

    // Three terminal states for the icon after a process close:
    //   1. App not running AND not pinned   → fully remove the icon.
    //   2. App still has running instances  → keep icon, update instance count + keep border.
    //   3. App not running but still pinned → keep icon, clear active border.
    if(!isAppRunning && !tskBarIcon.isPinned){
      this.removeIconFromTaskBarIconList(0, process.getProcessName, true);
    }else if(isAppRunning){
      // (The previous code wrote this as `(isAppRunning && tskBarIcon.isPinned) || (isAppRunning && !tskBarIcon.isPinned)`
      // which trivially simplifies to `isAppRunning`. Same behavior, less noise.)
      const instanceCount = this._runningProcessService.getProcessCount(process.getProcessName);
      tskBarIcon.instanceCount = instanceCount;
      setTimeout(() => { this.setIconState(true, tskBarIcon.opensWith, tskBarIcon.pId); }, delay);
    }else{
      // !isAppRunning && tskBarIcon.isPinned
      setTimeout(() => { this.setIconState(false, tskBarIcon.opensWith, tskBarIcon.pId); }, delay);
    }
  }

  getTaskBarIconInfo(file?:FileInfo , process?:Process):TaskBarIconInfo{
    // Shared empty shell — ensures every icon has the same shape, including the
    // `isFocused` / `isTransferActive` flags that drive the model-bound highlight.
    let taskBarIconInfo: TaskBarIconInfo = {
      pId: 0, uId: '', iconPath: '', defaultIconPath: '',
      opensWith: '', appName: '', displayName: '', showLabel: '',
      isRunning: false, isPinned: false, isOtherPinned: false, instanceCount: 0,
      isFocused: false, isTransferActive: false,
    };
    if(file){
      const currentState = this.getAppCurrentState(file,undefined);
       taskBarIconInfo = {
        uId:`${file.getOpensWith}-0`,
        pId:0,
        opensWith:file.getOpensWith,
        iconPath:file.getIconPath,
        defaultIconPath: file.getIconPath,
        appName: file.getOpensWith,
        displayName: file.getOpensWith,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:true,
        isOtherPinned:true,
        instanceCount: 0,
        isFocused: false,
        isTransferActive: false,
      }
    }else if(process){
      const currentState = this.getAppCurrentState(undefined,process);
      taskBarIconInfo = {
        uId:`${process.getProcessName}-${process.getProcessId}`,
        pId:process.getProcessId,
        opensWith: process.getProcessName,
        iconPath: process.getIcon,
        defaultIconPath: process.getIcon,
        appName: process.getProcessName,
        displayName: process.getProcessName,
        showLabel:currentState.showLabel,
        isRunning:currentState.isRunning,
        isPinned:false,
        isOtherPinned:false,
        instanceCount: 0,
        isFocused: false,
        isTransferActive: false,
      }
    }

    return taskBarIconInfo;
  }

  removeIconFromTaskBarIconList(pId:number, opensWith:string, isDefault:boolean):void{
    const isMerged = this.isMergedMode;
    const tskBarIcons = isMerged ? this.mergedTaskBarIconList : this.unMergedTaskBarIconList;
    let updatedIcons = tskBarIcons;
    if(isDefault){
      updatedIcons = isMerged
        ? tskBarIcons.filter(x => x.opensWith !== opensWith) 
        : tskBarIcons.filter(x => x.pId !== pId);
    }else{
      updatedIcons = tskBarIcons.filter(x => x.opensWith !== opensWith);
    }

    // Only swap the list reference if something was actually removed; this
    // avoids a no-op assignment that would still bust Angular's change
    // detection bookkeeping on the *Ngfor identity.
    if (updatedIcons.length !== tskBarIcons.length) {
      if (isMerged) {
        this.mergedTaskBarIconList = updatedIcons;
      } else {
        this.unMergedTaskBarIconList = updatedIcons;
      }
    }
  }

  onTaskBarIconClick(file:TaskBarIconInfo):void{

    if(!this._runningProcessService.isProcessRunning(file.opensWith)){
      const tmpFile:FileInfo = new FileInfo();
      tmpFile.setOpensWith = file.opensWith;
      this._processHandlerService.runApplication(tmpFile);
      return;
    }

    const pidWithHighestZIndex = this._windowServices.getProcessWindowIDWithHighestZIndex();

    if(this.isMergedMode){
      // Merged mode: a single icon represents N windows of the same app. We
      // only restore/minimize directly when there is exactly one instance,
      // otherwise the click should open the preview-list (handled elsewhere).
      const instanceCount = this._runningProcessService.getProcessCount(file.opensWith);
      if(instanceCount === 1){
        const process = this._runningProcessService.getProcesses().find(x => x.getProcessName === file.opensWith);
        if(process){
          this.handleWindowState(process.getProcessId, pidWithHighestZIndex); 
        }
      }
    }else{
      if(file.pId === 0) return; // pinned-but-not-running entry, ignore
      this.handleWindowState(file.pId, pidWithHighestZIndex);   
    }
  }

  private handleWindowState(pId: number, pidWithHighestZIndex: number): void {
    const windowState = this._windowServices.getWindowState(pId);

    if (!windowState) return;

    if(!windowState.isVisible){ // make window visible
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(pId);
    } else if(windowState.isVisible && (windowState.pId !== pidWithHighestZIndex)){ //set window to focus
      this._windowServices.focusOnCurrentProcessWindowNotify.next(pId);
    }else{ // make window hidden
      this._windowServices.restoreOrMinimizeProcessWindowNotify.next(pId);
    }
  }

  openApplication(file:FileInfo):void{
    this._processHandlerService.runApplication(file);
  }

  closeApplication(processes:Process[]):void{
    if(processes.length === 0) return;
    const firstProcess = processes[0];
    processes.forEach(p => this._runningProcessService.closeProcessNotify.next(p));

    // Clean up any window-state data keyed by the "pinned placeholder" uId
    // (`<name>-0`). Otherwise re-opening the app reuses stale layout info.
    const falsePid = 0;
    const falseUid = `${firstProcess.getProcessName}-${falsePid}`;
    this._windowServices.cleanupWindowDataForApp(falseUid);
  }

  onShowIconContextMenu(evt:MouseEvent, file:TaskBarIconInfo):void{
    /* The taskbar host has a max height of 40px which is too small to host the
     * context menu element directly, so we delegate menu rendering to the
     * desktop layer via `showTaskBarAppIconMenu`. We still compute the icon
     * rect here because the consumer needs absolute coordinates.
     */
    const elementId = this.isMergedMode
      ? `${this.tskbar}-${file.opensWith}`
      : `${this.tskbar}-${file.opensWith}-${file.pId}`;
    const liElemnt = document.getElementById(elementId) as HTMLElement | null;

    if(liElemnt){
      const rect =  liElemnt.getBoundingClientRect();
      const data:unknown[] = [rect, file];

      // Stop the event reaching the desktop <ol>, otherwise the desktop's own
      // right-click menu would open alongside this one. The menu itself is
      // rendered and owned by the desktop layer.
      evt.stopPropagation();
      this._menuService.showTaskBarAppIconMenu.next(data);
    }

    evt.preventDefault();
  }

  onMouseEnter(opensWith: string, pId: number, iconPath: string): void {
    const isAppRunning = this._runningProcessService.getProcesses().some(x => x.getProcessName === opensWith);
    const hoveredRect = this.highlightTaskbarIconOnMouseHover(opensWith, pId, isAppRunning);

    if(!isAppRunning  && hoveredRect){
      const data: TooltipPositionInfo = { left: hoveredRect.left, top: hoveredRect.top, appName: opensWith };
      this._systemNotificationService.showTaskBarToolTipNotify.next(data);
      return;
    }

    if(!hoveredRect)return;

    const left = this.computePreviewLeft(opensWith, hoveredRect);

    // Build the positioning object you pass to the preview
    const rectForPreview = {
      left,
      top: hoveredRect.top,     // or hoveredRect.top - previewHeight, depending on your UI
      width: hoveredRect.width,
      height: hoveredRect.height,
    };

    this.showTaskBarPreviewWindow(rectForPreview as RectLite, opensWith, pId, iconPath);
  }

  private computePreviewLeft(processName: string, hoveredRect: DOMRect): number {
    const taskbarRect = this.getTaskbarRect();
    const isUnmerged = !this.isMergedMode;

    // 1) Anchor X (center point)
    let anchorX = hoveredRect.left + hoveredRect.width / 2;

    // If unmerged + multiple instances: anchor to the *group* center
    if (isUnmerged) {
      const rects = this.getInstanceIconRects(processName);
      if (rects.length > 1) {
        const group = this.unionRect(rects);
        if (group) anchorX = group.left + group.width / 2;
      }
    }

    // 2) Total preview strip width
    const instanceCount = this._runningProcessService.getProcessCount(processName);
    const previewCount = (isUnmerged && instanceCount > 1) ? instanceCount : 1;

    const totalPreviewWidth =
      previewCount * this.PREVIEW_W + (previewCount - 1) * this.PREVIEW_GAP;

    // 3) Left position from anchor
    let left = anchorX - totalPreviewWidth / 2;

    // 4) Clamp within taskbar (recommended) or viewport
    const minLeft = taskbarRect ? taskbarRect.left : 0;
    const maxLeft = taskbarRect
      ? (taskbarRect.right - totalPreviewWidth)
      : (window.innerWidth - totalPreviewWidth);

    left = this.clamp(left, minLeft, maxLeft);

    return Math.round(left);
  }


  private getTaskbarRect(): DOMRect | null {
    const el = document.getElementById(this.taskBarId); 
    return el ? el.getBoundingClientRect() : null;
  }

  private getInstanceIconRects(processName: string): DOMRect[] {
    const instances = this._runningProcessService
      .getProcesses()
      .filter(x => x.getProcessName === processName);

    const rects: DOMRect[] = [];

    for (const p of instances) {
      const li = document.getElementById(`${this.tskbar}-${processName}-${p.getProcessId}`);
      if (!li) continue;
      rects.push(li.getBoundingClientRect());
    }

    return rects;
  }

  private unionRect(rects: DOMRect[]): RectLite | null {
    if (!rects.length) return null;

    let left = rects[0].left;
    let right = rects[0].right;
    let top = rects[0].top;
    let bottom = rects[0].bottom;

    for (const r of rects.slice(1)) {
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }

    return { left, right, top, width: right - left, height: bottom - top };
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }

  showTaskBarPreviewWindow(rect:RectLite, opensWith:string, pId:number, iconPath:string):void{
    const delay = 400;//400ms To allow the preview window to render before we send the highlight notification (350ms delay on the desktop),
    //  which ensures the highlight is applied correctly on the preview thumbnail
    const data:TaskBarPreviewPositionInfo = { rect: rect as DOMRect, iconPath, appName: opensWith };

    if(!this._runningProcessService.isProcessRunning(opensWith)) return;

    this._windowServices.showProcessPreviewWindowNotify.next(data);
    if(!this.isMergedMode){
      setTimeout(() => {this._systemNotificationService.taskBarPreviewHighlightNotify.next(`${opensWith}-${pId}`); }, delay);
    }
  }

  checkForMultipleActiveInstance(processName:string):boolean {
    if(!this.isMergedMode){
      const instanceCount = this._runningProcessService.getProcessCount(processName);
      if(instanceCount > 1){
        return true;
      }
    }
    return false;
  }


  updateTaskBarIcon(info:Map<number, string[]>):void{
    if(!info) return;

    const firstEntry = info.entries().next().value;
    if(!firstEntry) return;

    // App-driven rename/icon-change is only meaningful in unmerged mode where
    // each window has its own icon. In merged mode the app's default icon wins.
    if(this.isMergedMode) return;

    const [key, value] = firstEntry;
    const tskBarIconIdx = this.unMergedTaskBarIconList.findIndex(x => x.pId === key);
    if(tskBarIconIdx === -1) return;

    // Mutate in place — the previous "assign tskBarIcon back to the same
    // index" was a no-op (same object reference) and added no CD signal.
    const tskBarIcon = this.unMergedTaskBarIconList[tskBarIconIdx];
    tskBarIcon.displayName = value[0];
    tskBarIcon.iconPath = value[1];
  }

  onMouseLeave(processName?: string, pId?: number): void {
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this._systemNotificationService.hideTaskBarToolTipNotify.next();

    // Preview-thumbnail un-highlight is only meaningful when we have a real
    // process id. Important: use an explicit `!== undefined && !== 0` test
    // here — the previous `if (processName && pId)` form treated pid === 0
    // (pinned-but-not-running icons) the same as "no pid given", which silently
    // dropped legitimate un-highlight signals for that case.
    if (processName && pId !== undefined && pId !== 0) {
      this._systemNotificationService.taskBarPreviewUnHighlightNotify.next(`${processName}-${pId}`);
    }

    // No JS-driven re-paint needed: the `:hover` pseudo-class lifted, so the
    // underlying `is-focused`/`is-active` CSS state takes over automatically.
  }

  /**
   * Mouse-enter hook for an icon. The visual hover is handled purely by CSS
   * (`:hover` rules in the component stylesheet); this method's remaining
   * responsibility is to return the icon's bounding rect so the preview
   * window / tooltip can be positioned, and to keep the directive-free hover
   * state consistent across all icons.
   *
   * The `isAppRunning` parameter is no longer used to pick a colour (CSS
   * variants do that via `:not(.is-focused)` selectors) but it's still part
   * of the public signature for backwards compatibility with the template.
   */
  highlightTaskbarIconOnMouseHover(processName: string, pId: number, _isAppRunning: boolean): DOMRect | null {
    const elementId = this.isMergedMode
      ? `${this.tskbar}-${processName}`
      : `${this.tskbar}-${processName}-${pId}`;
    const liElement = document.getElementById(elementId) as HTMLElement | null;
    return liElement ? liElement.getBoundingClientRect() : null;
  }

  /**
   * Re-evaluate the focused-window highlight.
   *
   * Called both directly (after pin/unpin/mode-toggle) and via the focus-pid
   * timer in `onFocusChange`. The optional parameters let the timer pass the
   * snapshot of `prev`/`new` it captured at scheduling time — this avoids the
   * race where two focus changes within HIGHLIGHT_DELAY_MS would clobber
   * `this.prevWindowInFocusPid` before the first timer fires.
   */
  highlightTaskbarIcon(prevPid?: number, newPid?: number): void {
    if (!this.isAnyWindowInFocus) return;

    const newFocusPid = newPid ?? this.windowInFocusPid;

    // 1) Wipe any existing focus/transfer marker from BOTH lists. This both
    //    clears the previous focus and removes any stale highlight that a
    //    merged ⇄ unmerged toggle may have left behind, guaranteeing exactly
    //    one highlighted icon afterwards.
    this.clearAllFocusFlags();

    // 2) Resolve the now-focused process and the icon that represents it.
    const process = this._runningProcessService.getProcess(newFocusPid);
    if (!process) return;

    const icon = this.findIconByProcess(process.getProcessName, process.getProcessId);
    if (!icon) return;

    // 3) Special-case the file-transfer placeholder process — it gets a
    //    different visual (the shining gradient overlay) instead of the
    //    standard focus colour.
    if (process.getProcessName === Constants.BLANK_SPACE) {
      icon.isTransferActive = true;
      return;
    }

    icon.isFocused = true;
  }

  removeHighlightFromTaskbarIcon(pId?: number): void {
    // Explicit `!== undefined` test — a pid of 0 should not silently fall
    // through to `prevWindowInFocusPid` (that's what the old `if (pId)` did).
    const targetPid = pId !== undefined ? pId : this.prevWindowInFocusPid;
    this.clearFocusFor(targetPid);
  }

  restoreOrMinimizeWindow(processId:number){
    this._windowServices.restoreOrMinimizeProcessWindowNotify.next(processId);
  }

  storeTskBarState(app_data:TaskBarIconInfo, action:string):void{

    if(!this.sessionPinnedTaskbarIcons.some(x => x.opensWith === app_data.opensWith) && (action === this.pinAction)){
      // Persist a *clone* as the pinned-but-not-running placeholder. `app_data`
      // is frequently the LIVE icon object out of `unMergedTaskBarIconList`
      // (when pinning an already-running app), so mutating it here would corrupt
      // the running entry — zeroing its pId, clearing isRunning, hiding its
      // label — which both collapses the icon visually and breaks close (the
      // uId no longer matches `name-<realPid>`). Cloning keeps the live icon intact.
      const sessionIcon:TaskBarIconInfo = {
        ...app_data,
        uId: `${app_data.opensWith}-0`,
        pId: 0,
        iconPath: app_data.defaultIconPath,
        isRunning: false,
        showLabel: this.hideLabel,
      };

      this.sessionPinnedTaskbarIcons.push(sessionIcon);
    }else if(this.sessionPinnedTaskbarIcons.some(x => x.opensWith === app_data.opensWith) && (action === this.unPinAction)){
      this.sessionPinnedTaskbarIcons = this.sessionPinnedTaskbarIcons.filter(x => x.opensWith !== app_data.opensWith);
    }

    this._sessionManagementService.addSession(this.cheetahTskBarKey, this.sessionPinnedTaskbarIcons);
  }

  retrievePastSessionData():void{
    const tskBarData = this._sessionManagementService.getSession(this.cheetahTskBarKey) as TaskBarIconInfo[];

    if(tskBarData !== undefined)
      this.sessionPinnedTaskbarIcons.push(...tskBarData);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
