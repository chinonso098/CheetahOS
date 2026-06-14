/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, Input } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { TerminalCommand } from './model/terminal.types';
import { TerminalCommandProcessor } from './terminal.commands';
import { TerminalCommandRouter } from './command.router';
import {ITerminalCommandHost} from './model/terminal.types';
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { WindowResizeInfo } from 'src/app/shared/system-component/window/windows.types';
import { TabCompletionState } from './model/tab-completion.state';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { SystemMetric } from 'src/app/shared/system-service/system.metrics';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { InformationUpdate } from 'src/app/system-files/common.interfaces';
import { TERMINAL_OUTPUT_APP_NAME } from './model/terminal.types';
import { FileInfo } from 'src/app/system-files/file.info';

@Component({
  selector: 'cos-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css'],
  standalone:false,
})
export class TerminalComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy{

  @ViewChild('terminalCntnr', {static: true}) terminalCntnr!: ElementRef;
  @ViewChild('terminalOutputCntnr', {static: true}) terminalOutputCntnr!: ElementRef;
  @ViewChild('terminalHistoryOutput', {static: true}) terminalHistoryOutput!: ElementRef;
  
  @Input() priorUId = Constants.EMPTY_STRING;

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _maximizeWindowSub!:Subscription;
  private _minimizeWindowSub!:Subscription;
  private _windowResizeSub!:Subscription;
  private _formBuilder;
  private _terminaCommandsProc!:TerminalCommandProcessor;
  // Routes a parsed command to the processor and writes the result back onto
  // the TerminalCommand. Lives in command.router.ts to keep this component
  // focused on view concerns.
  private _commandRouter!:TerminalCommandRouter;
  private _commandHost!:ITerminalCommandHost;
  private _sessionManagementService!:SessionManagementService;
  private _windowService!:WindowService;
  private _fileService!:FileService;
  private _processHandlerService!:ProcessHandlerService;
  private _systemNotificationService!:SystemNotificationService;
  private _updateInformationSub!:Subscription;
  private _appState!:AppState;


  private msgPosCounter = 0;
  private prevPtrIndex = 0;
  private versionNum = '1.0.4.6';
  private SECONDS_DELAY:number[] = [120,250];
  private doesDirExist = true;

  // Handle to the typewriter interval used by populateWelecomeMessageField.
  // Tracked so we can clear it in ngOnDestroy and avoid a leak when the user
  // rapidly opens/closes the terminal window.
  private welcomeMsgIntervalId: ReturnType<typeof setInterval> | null = null;

  // ---------------------------------------------------------------------
  // Tab-completion state machine.
  //
  // All the small flags / counters that used to be sprinkled across the
  // component (firstSection, secondSection, swtichToNextSection,
  // firstSectionCntr, secondSectionCntr, sectionTabPressCntnr,
  // dirEntryTraverseCntr, fetchedDirectoryList, isInLoopState, ...)
  // now live on this single object. See TabCompletionState for the
  // semantics of each field.
  // ---------------------------------------------------------------------
  private _tab = new TabCompletionState();

  Success = 1;
  Fail = 2;
  Warning = 3;
  Options = 4;

  isBannerVisible = true;
  isWelcomeVisible = true;

  banner = Constants.EMPTY_STRING;
  welcomeMessage = Constants.EMPTY_STRING;
  terminalPrompt = ">";
  commandHistory:TerminalCommand[] = [];
  echoCommands:string[] = ["close", "curl","date", "echo", "help", "hostname", "list", "open", "sysmetric", "version", "whoami", "weather","pwd"];
  utilityCommands:string[] = ["all", "cat", "cd", "clear", "cp", "dir", "download","exit", "ls", "mkdir", "mv", "rm","touch"];
  generatedArguments:string[] = [];
  allCommands:string[] = [];
  _fileInfo!:FileInfo;

  terminalForm!: FormGroup;
  readonly SCROLL_DELAY = 300;

  hasWindow = true;
  isMaximizable = true;
  icon = `${Constants.IMAGE_BASE_PATH}terminal.png`;
  name = 'terminal';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Terminal';

  // Floor for honouring live resize broadcasts (matches CSS min-* on
  // .terminal-container). Below this we ignore the event.
  readonly MIN_WIDTH_PX = 480;
  readonly MIN_HEIGHT_PX = 320;

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, processHandlerService:ProcessHandlerService, fileService:FileService,  formBuilder:FormBuilder,
               sessionManagementService: SessionManagementService, windowService:WindowService, activityHistoryService:ActivityHistoryService, systemMetric:SystemMetric,
               systemNotificationService:SystemNotificationService ) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._formBuilder = formBuilder;
    this._sessionManagementService = sessionManagementService;
    this._windowService = windowService;
    this._fileService = fileService;
    this._systemNotificationService = systemNotificationService;
    this._processHandlerService = processHandlerService;
    this._terminaCommandsProc = new TerminalCommandProcessor(processHandlerService, runningProcessService, fileService, activityHistoryService, systemMetric, systemNotificationService);
    this._commandRouter = new TerminalCommandRouter(this._terminaCommandsProc);
    this._commandHost = this.createCommandHost();

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})

    // Live drag-resize. The CSS now makes the terminal fluid, so we just
    // need to clear the inline px sizes that maximize/minimize may have
    // written on the output / history elements; CSS flex then takes over.
    this._windowResizeSub = this._windowService.resizeProcessWindowNotify.subscribe((info:WindowResizeInfo) => {
      if(info.pId !== this.processId) return;
      if(info.widthPx < this.MIN_WIDTH_PX || info.heightPx < this.MIN_HEIGHT_PX) return;
      this.onWindowResize();
    });

    // Live progress for long-running commands (download / verbose cp,mv,rm).
    // The processor routes updates by the command's unique id; update the
    // matching command's output in place so the user sees continuous feedback.
    this._updateInformationSub = this._systemNotificationService.updateInformationNotify.subscribe((p) =>{
      if(p.appName === TERMINAL_OUTPUT_APP_NAME)
        this.updateTerminalOutput(p);
    });
  }

  ngOnInit():void{
    this.terminalForm = this._formBuilder.nonNullable.group({
      terminalCmd: Constants.EMPTY_STRING,
    });

    this.retrievePastSessionData();

    this.banner = this.getTerminalBanner();
    this.allCommands = [...this.echoCommands, ...this.utilityCommands];
  }

  async ngAfterViewInit():Promise<void>{
    //this.setTerminalWindowToFocus(this.processId); 
    this.populateWelecomeMessageField();

    if(this._fileInfo && this._fileInfo.getCurrentPath !== Constants.EMPTY_STRING){
      await this.navigateToPath();
    }

    await CommonFunctions.sleep(this.SECONDS_DELAY[1]);
    await this.captureComponentImg();
  }
  
  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
    this._windowResizeSub?.unsubscribe();
    this._updateInformationSub?.unsubscribe();

    // Stop the welcome-message typewriter if the component is torn down
    // before it finishes — prevents the interval from outliving the view.
    if(this.welcomeMsgIntervalId !== null){
      clearInterval(this.welcomeMsgIntervalId);
      this.welcomeMsgIntervalId = null;
    }
  }

  /** Drop the inline pixel sizes that maximize/minimize wrote so the
   *  CSS flex layout can reflow with the new primary-window size. */
  private onWindowResize():void{
    try{
      if(this.terminalOutputCntnr?.nativeElement?.style){
        this.terminalOutputCntnr.nativeElement.style.width = Constants.EMPTY_STRING;
        this.terminalOutputCntnr.nativeElement.style.height = Constants.EMPTY_STRING;
      }
      if(this.terminalHistoryOutput?.nativeElement?.style){
        this.terminalHistoryOutput.nativeElement.style.width = Constants.EMPTY_STRING;
        this.terminalHistoryOutput.nativeElement.style.height = Constants.EMPTY_STRING;
      }
    }catch{ /* view not ready */ }
  }

  async captureComponentImg():Promise<void>{  
    await CommonFunctions.captureComponentImgAsync(this.terminalCntnr, this.processId, this.name, this.icon, this._windowService);
    this.storeAppState();
  }

  async navigateToPath():Promise<void> {
    const path = this._fileInfo.getCurrentPath;
    const cmdString = `cd ${path}`;

    const terminalCommand = new TerminalCommand(cmdString, 0, Constants.EMPTY_STRING);
    await this.processCommand(terminalCommand, "Enter");
  }

  getYear():number {
    return new Date().getFullYear();
  }
  
  getTerminalBanner():string{
    // const banner = `
    //   ██████   █████  ███████ ██  ██████     ████████ ███████ ██████  ███    ███ ██ ███    ██  █████  ██      
    //   ██   ██ ██   ██ ██      ██ ██             ██    ██      ██   ██ ████  ████ ██ ████   ██ ██   ██ ██      
    //   ██████  ███████ ███████ ██ ██             ██    █████   ██████  ██ ████ ██ ██ ██ ██  ██ ███████ ██      
    //   ██   ██ ██   ██      ██ ██ ██             ██    ██      ██   ██ ██  ██  ██ ██ ██  ██ ██ ██   ██ ██      
    //   ██████  ██   ██ ███████ ██  ██████        ██    ███████ ██   ██ ██      ██ ██ ██   ████ ██   ██ ███████ 
    //                                                                                                                 \u00A9 ${this.getYear()}
    // `

    const banner = `Simple Terminal, CheetahOS [Version ${this.versionNum}] \u00A9 ${this.getYear()}`
    return banner;
  }

  populateWelecomeMessageField():void{
    const welcomeMessage = "Type 'help', or 'help -verbose' to view a list of available commands.";
    const msgArr :string[] = welcomeMessage.split(Constants.BLANK_SPACE);

    // Stash the interval id so ngOnDestroy can cancel it if the user closes
    // the terminal before the typewriter animation finishes.
    this.welcomeMsgIntervalId = setInterval((msg) => {
      let tmpCounter = 0;
      for(let i = 0; i < msg.length; i++){
        if (tmpCounter < 1){
          this.welcomeMessage +=(this.msgPosCounter === 0)? msg[this.msgPosCounter]:  Constants.BLANK_SPACE + msg[this.msgPosCounter];
          tmpCounter++;
        }
      }

      if(this.msgPosCounter === msg.length - 1){
        if(this.welcomeMsgIntervalId !== null){
          clearInterval(this.welcomeMsgIntervalId);
          this.welcomeMsgIntervalId = null;
        }
      }

      this.msgPosCounter++;
    },this.SECONDS_DELAY[0], msgArr);
  }

  onKeyDownOnWindow(evt:KeyboardEvent):void{
    if (evt.key === "Tab") {
      // Prevent tab from moving focus
      evt.preventDefault();
    }
  }

  onKeyDoublePressed(evt: KeyboardEvent):void {
    console.log(`${evt.key} Key pressed  rapidly.`);
  }

  focusOnInput(evt:MouseEvent):void{
    evt.stopPropagation();
    const cmdTxtBoxElm= document.getElementById(`cmdTxtBox-${this.processId}`) as HTMLInputElement;
    if(cmdTxtBoxElm){
      cmdTxtBoxElm?.focus();
    }
    this.focusWindow();
  }

  getCursorPosition():number{
    const cmdTxtBoxElm = document.getElementById(`cmdTxtBox-${this.processId}`) as HTMLInputElement;
    let curPos = 0;
    if(cmdTxtBoxElm){
      curPos = cmdTxtBoxElm.selectionStart || 0;
    }

    return curPos;
  }

  setCursorPosition(position:number):void{
    const cmdTxtBoxElm = document.getElementById(`cmdTxtBox-${this.processId}`) as HTMLInputElement;
    if(cmdTxtBoxElm){
      cmdTxtBoxElm.focus(); // Ensure the text field is focused
      cmdTxtBoxElm.setSelectionRange(position, position);
    }
  }

  getTabStateCount():number{
    return this._tab.sectionCount;
  }

  createTabState(cursorPos:number, idxSec?:number):void{
    this._tab.createSection(cursorPos, idxSec);
  }

  updateTabState(idx:number, cursorPos:number, rootArg:string):void{
    this._tab.updateSection(idx, cursorPos, rootArg);
  }

  scrollToBottom(): void {
    // Setting scrollTop on the (overflow:auto) output container is sufficient
    // to pin the view to the latest command output.
    //
    // The previous extra call to `scrollIntoView` on this same element bubbled
    // up to the nearest scrollable ancestor — `.window-content-container`,
    // which is `overflow: hidden`. `overflow: hidden` elements are still
    // programmatically scrollable, so scrollIntoView would shift the entire
    // terminal contents a few pixels up inside the primary window, exposing
    // the dark window background at the bottom and making the title bar look
    // shorter. A subsequent reflow (e.g. hovering a header button) would
    // reset that hidden scrollTop and the layout would "snap back". Removed.
    this.terminalOutputCntnr.nativeElement.scrollTop = this.terminalOutputCntnr.nativeElement.scrollHeight;
  }

  /**
   * Decide which "section" the cursor currently belongs to and update
   * the mode (STATE_ONE / STATE_TWO) plus the firstSection/secondSection
   * flags accordingly. Called on ArrowLeft / ArrowRight so the user can
   * jump between the source and destination paths in cp / mv.
   *
   * Legacy state-table (preserved):
   *   STATE_ONE
   *     firstSection active only
   *     firstSection inactive  secondSection active only
   *   STATE_TWO
   *     firstSection active   secondSection inactive
   *     firstSection inactive secondSection active
   */
  switchSections():void{
    const curCursorPos = this.getCursorPosition();
    const tab = this._tab;

    if(tab.sectionCount === 1){
      // Single-section mode: only re-assert STATE_ONE if the cursor
      // moved before the recorded section-0 position.
      const sectOneCursorPos = tab.sections[0]?.cursorPosition;
      if(curCursorPos < sectOneCursorPos){
        tab.currentState = TabCompletionState.STATE_ONE;
      }
    }else{
      // Two-section mode (cp / mv): figure out which section the cursor
      // is inside and flip the active flags.
      tab.currentState = TabCompletionState.STATE_TWO;
      const sectOneCursorPos = tab.sections[0]?.cursorPosition;
      const sectTwoCursorPos = tab.sections[1]?.cursorPosition;

      if(curCursorPos < sectOneCursorPos){
        tab.firstSection = true;
        tab.secondSection = false;
        tab.switchToNextSection = false;
        tab.firstSectionCounter = 0;
      }else if(curCursorPos > sectOneCursorPos && curCursorPos <= sectTwoCursorPos){
        tab.firstSection = false;
        tab.secondSection = true;
        tab.switchToNextSection = true;
        tab.secondSectionCounter = 0;
      }
    }
  }

  /**
   * Snap the cursor back to the recorded position for the active section
   * and restore the matching traversal counter. Called from the TAB
   * handler in two-section commands when the cursor has drifted.
   */
  changeCursorPositionAndNumCntr():void{
    const tab = this._tab;
    if(tab.sectionCount !== 2) return;

    const curCursorPos = this.getCursorPosition();
    const sectOneCursorPos = tab.sections[0]?.cursorPosition;
    const sectOneIdxCntr   = tab.sections[0]?.dirEntryTraverseCntr;
    const sectTwoCursorPos = tab.sections[1]?.cursorPosition;
    const sectTwoIdxCntr   = tab.sections[1]?.dirEntryTraverseCntr;

    if(tab.firstSection && (curCursorPos < sectOneCursorPos)){
      this.setCursorPosition(sectOneCursorPos);
      tab.dirEntryTraverseCounter = sectOneIdxCntr;
    }else if(tab.secondSection && (curCursorPos > sectOneCursorPos && curCursorPos < sectTwoCursorPos)){
      this.setCursorPosition(sectTwoCursorPos);
      tab.dirEntryTraverseCounter = sectTwoIdxCntr;
    }
  }

  async onKeyDownInInputBox(evt:KeyboardEvent):Promise<void>{
    console.log('evt.key:',evt.key);
    console.log('Cursor Position:', this.getCursorPosition());

    let cmdString = this.terminalForm.value.terminalCmd as string;
    const cmdStringArr = (cmdString === undefined)? [Constants.EMPTY_STRING] : cmdString.split(Constants.BLANK_SPACE);

    const rootCmd = cmdStringArr[0];
    let rootArg =cmdStringArr[1];
    if(evt.key === "Enter"){
      // Reset the cycling state so the next command starts fresh.
      this._tab.inLoopState = false;
      this._tab.dirEntryTraverseCounter = 0;
      const terminalCommand = new TerminalCommand(cmdString, 0, Constants.EMPTY_STRING);

      if(cmdString !== Constants.EMPTY_STRING){
        // Register the command in history BEFORE processing so live progress
        // updates (routed by commandID) can locate and update it while the
        // operation is still running.
        this.commandHistory.push(terminalCommand);
        this.prevPtrIndex = this.commandHistory.length;
        this.processCommand(terminalCommand, "Enter");
        this.terminalForm.reset();
        this.resetValues();
      }
    }else if(evt.key === "ArrowUp"){
      this.getCommandHistory("backward");
    }else if(evt.key === "ArrowDown"){
      this.getCommandHistory("forward")    
    } else if(evt.key === "ArrowLeft"){
      this.switchSections();
    }else if(evt.key === "ArrowRight"){
      this.switchSections();  
    }else if(evt.key === Constants.BLANK_SPACE){
      // SPACE after a valid command + a non-empty first argument means
      // the user is moving on to the destination argument (cp / mv). Flip
      // into STATE_TWO so the next TAB press operates on section 1.
      if(this.isValidInputArg(rootCmd) && (rootArg !== undefined && !this.stringIsOnlyWhiteSpace(rootArg))){
        this._tab.currentState = TabCompletionState.STATE_TWO;
        this._tab.switchToNextSection = true;
        this._tab.sectionTabPressCounter = 0;
      }
    } else if(evt.key === "Tab"){
      /**
       * Command-name auto-complete:
       * the root command must be defined, non-empty, and contain no
       * embedded whitespace. If it's not already a known command, see
       * if it uniquely (or ambiguously) prefixes one.
       */
      if(this.isValidInputArg(rootCmd)){
        if(!this.allCommands.includes(rootCmd)){
          const autoCmpltReslt = this.getAutoCompelete(rootCmd, this.allCommands);

          if(autoCmpltReslt.length === 1){
            this.terminalForm.setValue({terminalCmd: autoCmpltReslt[0]});
          }if(autoCmpltReslt.length > 1){
            // Ambiguous prefix: log the choices into the history view
            // so the user can see what's available.
            const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
            terminalCommand.setResponseCode = this.Options;
            terminalCommand.setCommandOutput = autoCmpltReslt.join(Constants.BLANK_SPACE);
            this.commandHistory.push(terminalCommand);
          }
        }
      }

      // ---- single-section commands (cd / rm) --------------------------
      if(rootCmd === "cd" || rootCmd === "rm"){
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this._tab.isWhitespaceAtEnd = this.checkForWhitSpaceAtTheEnd(cmdString);

          if(rootArg === undefined){
            // No argument typed yet: insert a space so the next TAB
            // starts the path-completion flow on a fresh argument.
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${Constants.BLANK_SPACE}`});
            return;
          }
        }else{
          if(cmdStringArr.length >= 2){
            // Drop a trailing empty token that appears if the user typed
            // a space after their path argument.
            if(cmdStringArr.length === 3)
              cmdStringArr.pop();

            rootArg  =  cmdStringArr[1];

            await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
          }
        }
      }
      // ---- download: just inject the "src:" prefix on first TAB ------
      else if(rootCmd === "download"){
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this._tab.isWhitespaceAtEnd = this.checkForWhitSpaceAtTheEnd(cmdString);
          const src = 'src:';

          if(rootArg === undefined){
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${src}`});
            return;
          }
        }
      }
      // ---- two-section commands (cp / mv) ----------------------------
      else if(rootCmd === "cp" || rootCmd === "mv"){
        // Case A: just the command typed, no argument yet -> prime the
        // form with a space and record section 0.
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this._tab.isWhitespaceAtEnd = this.checkForWhitSpaceAtTheEnd(cmdString);

          if(rootArg === undefined){
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${Constants.BLANK_SPACE}`});
            const cursorPos = this.getCursorPosition();
            this.createTabState(cursorPos);
            return;
          }
        }else{
          // Case B: at least one argument already present.
          if(cmdStringArr.length >= 2){
            this.changeCursorPositionAndNumCntr();

            // Sub-case B1: still cycling source path (section 0).
            if(cmdStringArr.length === 3 && !this._tab.switchToNextSection){
              cmdStringArr.pop();
              this._tab.sectionTabPressCounter++;
              rootArg  =  cmdStringArr[1];

              this.updateTabState(0, this.getCursorPosition(), rootArg);
            }
            // Sub-case B2: user pressed SPACE -> handing off to section 1.
            else if(cmdStringArr.length === 3 && this._tab.switchToNextSection){
              if(this._tab.sectionTabPressCounter === 0){
                // First TAB after the hand-off: persist section 0 state
                // and reset the working buffers for section 1.
                cmdStringArr.pop();
                this.updateTabState(0, this.getCursorPosition(), rootArg);

                rootArg = Constants.EMPTY_STRING;
                cmdString = 'cp  ';
                this._tab.firstSection = false;
                this._tab.secondSection = true;
                this._tab.dirEntryTraverseCounter = 0;
                this._tab.fetchedDirectoryList = [];

                const cursorPos = this.getCursorPosition();
                this.createTabState(cursorPos, 1);
              }else{
                // Subsequent TABs in section 1: keep cycling the dest.
                rootArg  =  cmdStringArr[2];
                this.updateTabState(1, this.getCursorPosition(), rootArg);
              }
              this._tab.sectionTabPressCounter++;
            }else{
              rootArg  =  cmdStringArr[1];
            }

            await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
          }
        }
      }
      // ---- everything else: generic argument auto-complete -----------
      else{
        if(!this.generatedArguments.includes(rootArg)){
          const autoCmpltReslt = this.getAutoCompelete(rootArg, this.generatedArguments);
          if(autoCmpltReslt.length >= 1){
            this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
          }
        }
      }
      evt.preventDefault();
    }else{
      // Any other keystroke breaks us out of the cycling loop so the
      // next TAB starts a fresh directory listing.
      this._tab.inLoopState = false;
    }
  }


  async handleChangeDirectoryRequest(cmdString: string, rootCmd: string, rootArg: string): Promise<void> {
      if (this.isValidInputArg(rootArg)) {
          const alteredRootArg = this.getLastSegment(rootArg);

          if (!this._tab.inLoopState) {
              await this.processDirectoryTraversal(cmdString, rootCmd, rootArg, alteredRootArg);
          } else {
              await this.processSection(rootCmd, rootArg, alteredRootArg);
          }
      } else {
          await this.handleEmptyRootArg(cmdString, rootCmd, rootArg);
      }
  }

  /** Helper to check if inputArg is valid */
  private isValidInputArg(inputArg: string): boolean {
      return ((inputArg !== undefined && inputArg.length > 0) && (!inputArg.includes(Constants.BLANK_SPACE)));
  }

  /** Handles directory traversal when outside loop state */
  private async processDirectoryTraversal(cmdString: string, rootCmd: string, rootArg: string, alteredRootArg: string): Promise<void> {
      // Only re-fetch when we don't already have this entry cached.
      if (!this._tab.fetchedDirectoryList.includes(alteredRootArg)) {
          const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
          await this.traverseDirectoryHelper(terminalCommand);
      }
      this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, alteredRootArg);
      this._tab.inLoopState = true;
  }

  /** Processes section-based directory traversal */
  private async processSection(rootCmd: string, rootArg: string, alteredRootArg: string): Promise<void> {
      const tab = this._tab;
      if (tab.firstSection && tab.firstSectionCounter === 0) {
          await this.processSpecificSection(0, rootCmd, rootArg, alteredRootArg);
      } else if (tab.secondSection && tab.secondSectionCounter === 0) {
          await this.processSpecificSection(1, rootCmd, rootArg, alteredRootArg);
      } else {
          this.loopThroughDirectory(rootCmd, rootArg, alteredRootArg);
      }
  }

  /** Processes a specific section */
  private async processSpecificSection(sectionIndex: number, rootCmd: string, rootArg: string, alteredRootArg: string): Promise<void> {
      if (sectionIndex === 0) this._tab.firstSectionCounter--;
      else this._tab.secondSectionCounter--;

      // Synthesize a fake command ("lx <path>") used by traverseDirectoryHelper
      // to read the listing for the section's recorded path.
      const alteredCmdString = `lx ${this.removeCurrentDir(rootArg)}`;
      const terminalCommand = new TerminalCommand(alteredCmdString, 0, Constants.BLANK_SPACE);

      await this.traverseDirectoryHelper(terminalCommand);
      this.loopThroughDirectory(rootCmd, rootArg, alteredRootArg);
      this._tab.dirEntryTraverseCounter = this._tab.sections[sectionIndex].dirEntryTraverseCntr;
  }

  /** Handles cases where rootArg is empty */
  private async handleEmptyRootArg(cmdString: string, rootCmd: string, rootArg: string): Promise<void> {
      if (this._tab.fetchedDirectoryList.length === 0) {
          const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
          await this.traverseDirectoryHelper(terminalCommand);
          this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, Constants.EMPTY_STRING);
          this._tab.inLoopState = true;
      } else {
          await this.handleLoopState(rootCmd, rootArg);
      }
  }

  /** Handles loop state logic */
  private async handleLoopState(rootCmd: string, rootArg: string): Promise<void> {
      if (this._tab.inLoopState) {
          this.updateTerminalForm(rootCmd, rootArg);
          this._tab.dirEntryTraverseCounter++;
      } else {
          this.loopThroughDirectory(rootCmd, rootArg, Constants.EMPTY_STRING);
      }
  }

  /** Updates the terminal form based on rootArg */
  private updateTerminalForm(rootCmd: string, rootArg: string): void {
      const firstPath = this._tab.fetchedDirectoryList[0];
      const inStateOne = this._tab.currentState === TabCompletionState.STATE_ONE;

      if (rootArg.includes(Constants.ROOT)) {
          if (inStateOne) {
              this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${firstPath}` });
          } else {
              this.updateMultiSectionPath(rootCmd, rootArg, firstPath);
          }
      } else {
          if (inStateOne) {
              this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${firstPath}` });
          } else {
              this.updateMultiSectionPath(rootCmd, rootArg, firstPath);
          }
      }
  }

  /** Updates multi-section paths */
  private updateMultiSectionPath(rootCmd: string, rootArg: string, firstPath: string): void {
      const tab = this._tab;
      if (tab.firstSection) {
          this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${firstPath} ${tab.sections[1].currentPath}` });
      }
      if (tab.secondSection) {
          this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${tab.sections[0].currentPath} ${firstPath}` });
      }
  }

  loopThroughDirectory(rootCmd:string, rootArg:string,  alteredRootArg:string):void{
    // Suppress unused-param warning while keeping the public signature.
    void alteredRootArg;

    const tab = this._tab;
    const curNum = tab.dirEntryTraverseCounter++;
    const inStateOne = tab.currentState === TabCompletionState.STATE_ONE;

    if((tab.directoryTraversalDepth > 1)){
      // Deep path: keep the user's directory prefix and only swap the
      // trailing segment with the next completion candidate.
      if(this.countSlahesInPath(rootArg) <= 1){
        if(!this.checkForCharAfterSlashRegex(rootArg)){
          rootArg = this.stripAfterSlash(rootArg);
        }
      }

      if(inStateOne){
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${tab.fetchedDirectoryList[curNum]}`});
      }else{
        if(tab.firstSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${tab.fetchedDirectoryList[curNum]} ${tab.sections[1].currentPath} `});

        if(tab.secondSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${tab.sections[0].currentPath} ${this.removeCurrentDir(rootArg)}${tab.fetchedDirectoryList[curNum]}`});
      }


    }else if(tab.directoryTraversalDepth >= 0 && tab.directoryTraversalDepth <= 1){
      // Shallow path: just substitute the entire argument.
      if(inStateOne){
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${tab.fetchedDirectoryList[curNum]}`});
      }else{
        if(tab.firstSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${tab.fetchedDirectoryList[curNum]} ${tab.sections[1].currentPath}`});

        if(tab.secondSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${tab.sections[0].currentPath} ${tab.fetchedDirectoryList[curNum]}`});
      }
    }

    // Wrap the cycling index back to 0 when we walk past the end of the
    // listing so repeated TABs cycle indefinitely.
    if(tab.dirEntryTraverseCounter > tab.fetchedDirectoryList.length - 1){
      tab.dirEntryTraverseCounter = 0;
    }
  }

  evaluateChangeDirectoryRequest(cmdString:string, rootCmd:string, rootArg:string, alteredRootArg:string):boolean{
    const tab = this._tab;
    const autoCmpltReslt = this.getAutoCompelete(alteredRootArg, tab.fetchedDirectoryList);
    let result = false;
    if(autoCmpltReslt.length === 1){
      // Single match: apply unless we've already applied this exact
      // completion (avoids re-stomping the form on every keystroke).
      if((rootArg.includes(Constants.ROOT) && rootArg !== tab.lastSeenRootArg) &&  (tab.lastSeenAutoComplete !== autoCmpltReslt[0])){
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`});
        tab.lastSeenRootArg = `${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`;
        tab.lastSeenAutoComplete = autoCmpltReslt[0];
      }else if(!rootArg.includes(Constants.ROOT)){
        tab.lastSeenAutoComplete = autoCmpltReslt[0];
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
      }
      result = true;
    }else if(autoCmpltReslt.length > 1){
      // Ambiguous: dump the candidates into history for the user.
      const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = autoCmpltReslt.join(Constants.BLANK_SPACE);
      this.commandHistory.push(terminalCommand);
      result = true;
    }else{
      // No match: still show the listing so the user can see what's there.
      const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = tab.fetchedDirectoryList.join(Constants.BLANK_SPACE);
      this.commandHistory.push(terminalCommand);
      result = true;
    }

    return result;
  }

  removeCurrentDir(arg0:string):string{

    /**
     * give an input like Document/, Games/Data/In/, Documents/Sample, Games/FlashGames/Moz, ABC/DEF/HIJ/KlM/, ABC/DEF/HIJ/KlM/NO
     * return Document/, Games/Data/, Documents, Games/FlashGames/, ABC/DEF/HIJ/, ABC/DEF/HIJ/KlM/
     */
    let result = Constants.EMPTY_STRING;

    if(this._tab.isWhitespaceAtEnd)
        return arg0;

    if(arg0.includes(Constants.ROOT)) {
      const argSplit = arg0.split(Constants.ROOT).filter(x => x !== Constants.EMPTY_STRING);
      const res:string[] = [];

      if(argSplit.length === 1)
          return `${argSplit[0]}/`;
      else{
        argSplit.pop();

        for(let i = 0; i <= argSplit.length - 1; i++){
          res.push(`${argSplit[i]}/`);
        }
      }
      result = res.join(Constants.EMPTY_STRING);
    }

    return result.replace(Constants.COMMA, Constants.EMPTY_STRING);
  }

  getLastSegment(arg0:string):string{
    /**
     * give an input like Document/PD, Games/Data/In
     * return PD, In
     */
    const rootArgs = arg0.split(Constants.ROOT);
    let rootArg = Constants.EMPTY_STRING;

    if(rootArgs.length === 1) {
      rootArg =  rootArgs[0];
    }else if (rootArgs.length >1){
      if(rootArgs.slice(-1)[0] !== Constants.EMPTY_STRING){
         rootArg = rootArgs.slice(-1)[0];
      }else{
        rootArg = rootArgs.slice(-2)[0];
      }
    }

    return rootArg;
  }

  countSlahesInPath(input: string): number {
    const matches = input.match(/\//g);
    return matches ? matches.length : 0;
  }

  checkForCharAfterSlashRegex(input: string): boolean {
    const match = input.match(/\/(.)/);
    return match ? true : false;
  }

  stripAfterSlash(input: string): string {
    return input.split(Constants.ROOT)[0]; 
  } 

  checkForWhitSpaceAtTheEnd(arg0:string):boolean {
    const whitespaceChars = [' ', '\t', '\n'];
    return whitespaceChars.some(char => arg0.slice(-1).includes(char));
  }

  /** Thin wrapper kept for clarity at call sites in the Enter handler. */
  resetValues():void{
    this._tab.reset();
  }

  isOption(arg0:string):boolean{
    const firstChar = arg0[0];
    return (firstChar === Constants.DASH)? true : false;
  }

  getCommandHistory(direction:string):void{

    let currPtrIndex = 0;
    if(this.commandHistory.length > 0){
      if(direction === "backward"){
        currPtrIndex = (this.prevPtrIndex === 0)? 0 : this.prevPtrIndex - 1;
      }else if(direction === "forward"){
        currPtrIndex = (this.prevPtrIndex === this.commandHistory.length)? 
          this.commandHistory.length : this.prevPtrIndex + 1
      }

      // Clamp into [0, length] so external mutations to commandHistory (e.g.
      // `clear`) cannot leave the pointer pointing past the end of the array.
      if(currPtrIndex < 0) currPtrIndex = 0;
      if(currPtrIndex > this.commandHistory.length) currPtrIndex = this.commandHistory.length;

      this.prevPtrIndex = currPtrIndex;
      (currPtrIndex === this.commandHistory.length) ? 
        this.terminalForm.setValue({terminalCmd:Constants.EMPTY_STRING}) : 
        this.terminalForm.setValue({terminalCmd: this.commandHistory[currPtrIndex].getCommand});
    }
  }

  isInAllCommands(arg: string): boolean {
    if(this.allCommands.includes(arg))
      return true;
    else
    return  false
  }

  isValidCommand(arg: string): boolean{
    return this.isInAllCommands(arg)
  }

  stringIsOnlyWhiteSpace(arg: string): boolean{
    return  !arg.replace(/\s/g, Constants.EMPTY_STRING).length;
  }

  async traverseDirectoryHelper(terminalCmd:TerminalCommand):Promise<void>{
    const cmdStringArr = terminalCmd.getCommand.split(Constants.BLANK_SPACE);
    // Section 0 -> token index 1 (source path); section 1 -> token index 2 (dest path).
    const path = this._tab.firstSection ? cmdStringArr[1] : cmdStringArr[2];

    const str = 'string';
    const strArr = 'string[]';

    const result = await this._terminaCommandsProc.traverseDirectory(path);

    if(result.type === str || result.type === strArr)
      terminalCmd.setResponseCode = this.Success;

    if(result.type === str){
      terminalCmd.setCommandOutput = result.result;
      this.doesDirExist = false;
      this._tab.directoryTraversalDepth = result.depth;
    }
    else if(result.type === strArr){
      // Cache the directory listing for cycling and reset the index.
      this._tab.fetchedDirectoryList = [...result.result as string[]];
      this._tab.dirEntryTraverseCounter = 0;
      this.doesDirExist = true;
      this._tab.directoryTraversalDepth = result.depth;
    }

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
  }

  async processCommand(terminalCmd:TerminalCommand, key=""):Promise<void>{
    // Suppress unused-param warning while keeping the public signature.
    void key;

    // Dispatch lives in command.router.ts. It reads the few component values it
    // needs (and pushes back the `clear` / `ls` side-effects) through the host
    // adapter built in createCommandHost(); everything else it writes directly
    // onto terminalCmd.
    await this._commandRouter.route(terminalCmd, this._commandHost);

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
    this.storeAppState();
  }

  /**
   * Build the narrow adapter the command router uses to read component state
   * and apply the handful of side-effects it owns. Getters keep the values
   * live (e.g. processId is assigned after this object is created) and keep
   * the component's private fields private.
   */
  private createCommandHost():ITerminalCommandHost{
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      get Success(){ return self.Success; },
      get Fail(){ return self.Fail; },
      get Options(){ return self.Options; },
      get processId(){ return self.processId; },
      get versionNum(){ return self.versionNum; },
      get echoCommands(){ return self.echoCommands; },
      get utilityCommands(){ return self.utilityCommands; },
      isValidCommand: (cmd:string) => self.isValidCommand(cmd),
      clearScreen: () => {
        self.commandHistory = [];
        self.isBannerVisible = false;
        self.isWelcomeVisible = false;
      },
      setDoesDirExist: (exists:boolean) => { self.doesDirExist = exists; },
      setFetchedDirectoryList: (list:string[]) => { self._tab.fetchedDirectoryList = list; },
    };
  }

  /**
   * Live progress sink. The command processor routes updates by the command's
   * unique id (carried in update.pId); find the matching command in history and
   * refresh its output in place so the user sees continuous feedback while a
   * long-running operation (download / verbose cp,mv,rm) is still in flight.
   */
  updateTerminalOutput(update:InformationUpdate):void{
    if(!update || !Array.isArray(update.info) || update.info.length === 0)
      return;

    const cmd = this.commandHistory.find(c => c.getCommandID === update.pId);
    if(!cmd)
      return;

    cmd.setResponseCode = this.Success;
    cmd.setCommandOutput = update.info[0];
    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
  }

  /***
   * arg0: what is being searched for
   * arg1: Where x is being search in
   */
  getAutoCompelete(arg0:string, arg1:string[]): string[]{
    // eslint-disable-next-line prefer-const
    let matchingCommand =  arg1.filter((x) => x.startsWith(arg0.trim()));
    return (matchingCommand.length > 0) ? matchingCommand : [];
  }

  maximizeWindow():void{
    // Bring maximize in line with the responsive layout: the CSS flex chain
    // (.terminal-container -> .terminal-output-section) fills whatever the
    // primary window gives us, so we no longer measure #vantaCntnr and stamp
    // explicit pixel sizes (which double-counted chrome and fought the flex
    // parent). Just clear any stale inline px and let CSS reflow.
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
  }

  minimizeWindow(arg:number[]):void{
    // Restore from maximized. Same reasoning as maximizeWindow — the window
    // component owns the box size; we only strip leftover inline px so the
    // CSS flex chain can reflow to the restored size. (arg carries the
    // restored [width,height] but is no longer needed imperatively; kept
    // for the subscription signature.)
    void arg;
    const uId = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOriginator();

    if(uId === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      this.onWindowResize();
    }
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu. The desktop's menu is opened by a (contextmenu) handler on the
    // desktop root, which receives this event as it bubbles up the DOM.
    // Stopping propagation here means the event never reaches the desktop,
    // so its menu never opens — no shared service flag required.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  storeAppState():void{
    const cmdHistory = this.commandHistory;
    const cmdList:string[] = [];
    const uId = `${this.name}-${this.processId}`;

    for(let i = 0; i < cmdHistory.length; i++){
      cmdList.push(cmdHistory[i].getCommand);
    }

    this._appState = {
      pId: this.processId,
      appData: cmdList,
      appName: this.name,
      uId: uId,
      window: {appName:'', pId:0, leftPx:0, topPx:0, heightPx:0, widthPx:0, zIndex:0, isVisible:true}
    }

    this._sessionManagementService.addAppSession(uId, this._appState);
  }

  async onDrop(event:DragEvent):Promise<void>{
    event.preventDefault();
    event.stopPropagation();

    const fileData = this._fileService.getDragAndDropFile();

    if(fileData.length === 1){
      const cmd = this.terminalForm.value.terminalCmd as string;
      this.terminalForm.setValue({
        terminalCmd: `${cmd}${fileData[0].getCurrentPath}`
      })
    }
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagementService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.appData != Constants.EMPTY_STRING){
        const terminalCmds =  appSessionData.appData as string[];
        for(let i = 0; i < terminalCmds.length; i++){
          const cmd = new TerminalCommand(terminalCmds[i], 0, Constants.EMPTY_STRING);
          this.commandHistory.push(cmd);
        }
    }
  }

  private getComponentDetail():Process{
    this._fileInfo = this._processHandlerService.getLastProcessTrigger(this.name);
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
