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
import { AppState } from 'src/app/system-files/state/state.interface';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ITabState, IState } from './model/terminal.types';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';

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

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _formBuilder;
  private _terminaCommandsProc!:TerminalCommandProcessor;
  private _sessionManagmentService: SessionManagmentService;
  private _windowService:WindowService;
  private _appState!:AppState;


  private msgPosCounter = 0;
  private prevPtrIndex = 0;
  private versionNum = '1.0.4.4';
  private SECONDS_DELAY:number[] = [120,250];
  private doesDirExist = true;
  private isInLoopState = false;
  private isWhiteSpaceAtTheEnd = false;

  private tabCompletionState:ITabState = {
    sections: [],
  };

  stateOne = 'S1';
  stateTwo = 'S2';

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
  echoCommands:string[] = ["close", "curl","date", "echo", "help", "hostname", "list", "open", "version", "whoami", "weather","pwd"];
  utilityCommands:string[] = ["all", "cat", "cd", "clear", "cp", "dir", "download","exit", "ls", "mkdir", "mv", "rm","touch"];
  fetchedDirectoryList:string[] = [];
  generatedArguments:string[] = [];
  allCommands:string[] = [];
  haveISeenThisRootArg = Constants.EMPTY_STRING;
  haveISeenThisAutoCmplt = Constants.EMPTY_STRING;

  terminalForm!: FormGroup;
  dirEntryTraverseCntr = 0;
  directoryTraversalDepth = 0;
  readonly SCROLL_DELAY = 300;
  firstSection = true;
  secondSection = false;
  sectionTabPressCntnr = 0;

  firstSectionCntr = -1;
  secondSectionCntr = -1;
  currentState =  this.stateOne;
  swtichToNextSection = false;

  hasWindow = true;
  isMaximizable = false;
  icon = `${Constants.IMAGE_BASE_PATH}terminal.png`;
  name = 'terminal';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Terminal';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, controlProcessService:ProcessHandlerService, fileService:FileService,  formBuilder:FormBuilder,
               sessionManagmentService: SessionManagmentService,windowService:WindowService ) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._formBuilder = formBuilder;
    this._sessionManagmentService = sessionManagmentService;
    this._windowService = windowService;
    
    this._terminaCommandsProc = new TerminalCommandProcessor(controlProcessService,runningProcessService,fileService);

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this._maximizeWindowSub = this._windowService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._windowService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
  }

  ngOnInit():void{
    this.terminalForm = this._formBuilder.nonNullable.group({
      terminalCmd: '',
    });

    this.retrievePastSessionData();

    this.banner = this.getTerminalBanner();
    this.allCommands = [...this.echoCommands, ...this.utilityCommands];
  }

  ngAfterViewInit():void{
    //this.setTerminalWindowToFocus(this.processId); 
    this.populateWelecomeMessageField();

    setTimeout(()=>{
      this.captureComponentImg();
    },this.SECONDS_DELAY[1]) 
  }
  
  ngOnDestroy():void{
    this._maximizeWindowSub?.unsubscribe();
    this._minimizeWindowSub?.unsubscribe();
  }

  captureComponentImg():void{
    htmlToImage.toPng(this.terminalCntnr.nativeElement).then(htmlImg =>{
      //console.log('img data:',htmlImg);

      const cmpntImg:TaskBarPreviewImage = {
        pid: this.processId,
        appName: this.name,
        displayName: this.name,
        icon : this.icon,
        defaultIcon: this.icon,
        imageData: htmlImg
      }
      this._windowService.addProcessPreviewImage(this.name, cmpntImg);
    });

    this.storeAppState();
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

    const interval =  setInterval((msg) => {
      let tmpCounter = 0;
      for(let i = 0; i < msg.length; i++){
        if (tmpCounter < 1){
          this.welcomeMessage +=(this.msgPosCounter === 0)? msg[this.msgPosCounter]:  Constants.BLANK_SPACE + msg[this.msgPosCounter];
          tmpCounter++;
        }
      }

      if(this.msgPosCounter === msg.length - 1)
        clearInterval(interval);

      this.msgPosCounter++;
    },this.SECONDS_DELAY[0], msgArr);
  }

  onKeyDownOnWindow(evt:KeyboardEvent):void{
    this.focusOnInput(evt);
    if (evt.key === "Tab") {
      // Prevent tab from moving focus
      evt.preventDefault();
    }
  }

  onKeyDoublePressed(evt: KeyboardEvent):void {
    console.log(`${evt.key} Key pressed  rapidly.`);
  }


  focusOnInput(evt:any):void{
    this.setTerminalWindowToFocus(this.processId);
    const cmdTxtBoxElm= document.getElementById(`cmdTxtBox-${this.processId}`) as HTMLInputElement;
    if(cmdTxtBoxElm){
      cmdTxtBoxElm?.focus();
    }
    evt.stopPropagation();
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
    return this.tabCompletionState.sections.length;
  }

  createTabState(cursorPos:number, idxSec?:number):void{
    const writeState:IState ={
      cursorPosition: cursorPos,
      indexSection: idxSec || 0,
      dirEntryTraverseCntr:0,
      currentPath:Constants.BLANK_SPACE 
    }

    this.tabCompletionState.sections.push(writeState);
  }

  updateTabState(idx:number, cursorPos:number, rootArg:string):void{
    const writeState = this.tabCompletionState.sections[idx];

    if(writeState){
      writeState.cursorPosition = cursorPos
      writeState.currentPath = rootArg;
      writeState.dirEntryTraverseCntr = this.dirEntryTraverseCntr;
      this.tabCompletionState.sections[idx] = writeState;
    }
  }

  scrollToBottom(): void {
    this.terminalOutputCntnr.nativeElement.scrollTop = this.terminalOutputCntnr.nativeElement.scrollHeight;
    this.terminalOutputCntnr.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }


  switchSections():void{
    /*
      State 1
        firstSection Active only
        firstSection Inactive  secondSection Active only
      State 2
        firstSection Avtive  secondSection Inactive only
        firstSection Inactive  secondSection Active only
      Store fetches Directories & numCntr state for each section */

    const curCursorPos = this.getCursorPosition();
    let sectOneCursorPos = 0;
    let sectTwoCursorPos = 0;

    if(this.getTabStateCount() === 1){
      //state 1
      sectOneCursorPos = this.tabCompletionState.sections[0]?.cursorPosition;
      if(curCursorPos < sectOneCursorPos){
        this.currentState = this.stateOne;
      }
    }else{
      this.currentState = this.stateTwo;
      sectOneCursorPos = this.tabCompletionState.sections[0]?.cursorPosition;
      sectTwoCursorPos = this.tabCompletionState.sections[1]?.cursorPosition;
      if(curCursorPos < sectOneCursorPos){
        this.firstSection = true;
        this.secondSection = false;
        this.swtichToNextSection = false;
        this.firstSectionCntr = 0;
      }else if(curCursorPos > sectOneCursorPos && curCursorPos <= sectTwoCursorPos){
        this.firstSection = false
        this.secondSection = true;
        this.swtichToNextSection = true;
        this.secondSectionCntr = 0;
      }
    }
  }

  changeCursorPositionAndNumCntr():void{
    const curCursorPos = this.getCursorPosition();
    if(this.getTabStateCount() === 1){
      //
    }else if(this.getTabStateCount() === 2){
      const sectOneCursorPos = this.tabCompletionState.sections[0]?.cursorPosition;
      const sectOneIdxCntr = this.tabCompletionState.sections[0]?.dirEntryTraverseCntr;
      const sectTwoCursorPos = this.tabCompletionState.sections[1]?.cursorPosition;
      const sectTwoIdxCntr = this.tabCompletionState.sections[1]?.dirEntryTraverseCntr;

      if(this.firstSection && (curCursorPos < sectOneCursorPos)){
        this.setCursorPosition(sectOneCursorPos);
        this.dirEntryTraverseCntr = sectOneIdxCntr;
      }else if(this.secondSection && (curCursorPos > sectOneCursorPos && curCursorPos < sectTwoCursorPos)){
        this.setCursorPosition(sectTwoCursorPos);
        this.dirEntryTraverseCntr = sectTwoIdxCntr;
      }
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
      this.isInLoopState = false;
      this.dirEntryTraverseCntr = 0;
      const terminalCommand = new TerminalCommand(cmdString, 0, '');

      if(cmdString !== Constants.EMPTY_STRING){
        this.processCommand(terminalCommand, "Enter");
        this.commandHistory.push(terminalCommand);
        this.prevPtrIndex = this.commandHistory.length;
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
      if(this.isValidInputArg(rootCmd) && (rootArg !== undefined && !this.stringIsOnlyWhiteSpace(rootArg))){
        this.currentState = this.stateTwo;
        this.swtichToNextSection = true;
        this.sectionTabPressCntnr = 0;
      }

      console.log('this.swtichToNextSection:',this.swtichToNextSection);
    } else if(evt.key === "Tab"){
      //console.log('rootCmd:',rootCmd);
      /**
       * the command part of the command string, can not be undefined, must have a length greater than 0, and cannot contain space
       */
      if(this.isValidInputArg(rootCmd)){
        if(!this.allCommands.includes(rootCmd)){
          const autoCmpltReslt = this.getAutoCompelete(rootCmd, this.allCommands);

          if(autoCmpltReslt.length === 1){
            this.terminalForm.setValue({terminalCmd: autoCmpltReslt[0]});
          }if(autoCmpltReslt.length > 1){
            const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
            terminalCommand.setResponseCode = this.Options;
            terminalCommand.setCommandOutput = autoCmpltReslt.join(Constants.BLANK_SPACE);
            this.commandHistory.push(terminalCommand);
          }
        }
      }

      //console.log('rootArg:',rootArg);
      if(rootCmd === "cd" || rootCmd === "rm"){
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this.isWhiteSpaceAtTheEnd = this.checkForWhitSpaceAtTheEnd(cmdString);
  
          if(rootArg === undefined){
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${Constants.BLANK_SPACE}`});
            return;
          }
        }else{
          if(cmdStringArr.length >= 2){

            if(cmdStringArr.length === 3)
              cmdStringArr.pop();

            rootArg  =  cmdStringArr[1];
    
            await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
          }
        }
      }else if(rootCmd === "download"){
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this.isWhiteSpaceAtTheEnd = this.checkForWhitSpaceAtTheEnd(cmdString);
          const src = 'src:';
  
          if(rootArg === undefined){
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${src}`});
            return;
          }
        }
      }
      
      else if(rootCmd === "cp" || rootCmd === "mv"){        
        //case where cp is rootCmd, but there is no space following rootCmd. Add space
        if(cmdStringArr.length === 1){
          rootArg  =  cmdStringArr[1];
          this.isWhiteSpaceAtTheEnd = this.checkForWhitSpaceAtTheEnd(cmdString);
          console.log('Has-White-Space-At-The- sEnd:', this.isWhiteSpaceAtTheEnd);

          if(rootArg === undefined){
            console.log('setValue - 0');
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${Constants.BLANK_SPACE}`});
            const cursorPos = this.getCursorPosition();
            this.createTabState(cursorPos);
            return;
          }
        }else{
            //case where cp is rootCmd, and rootArg could be empty space or something else
          if(cmdStringArr.length >= 2){
            this.changeCursorPositionAndNumCntr();
            //condition to switch to next section, not met. still on the 1st section
            if(cmdStringArr.length === 3 && !this.swtichToNextSection){
              cmdStringArr.pop();
              this.sectionTabPressCntnr++;
              rootArg  =  cmdStringArr[1];

              this.updateTabState(0, this.getCursorPosition(), rootArg);
            } 
            //condition to switch to next section, met. now on the 2nd section
            else if(cmdStringArr.length === 3 && this.swtichToNextSection){
              if(this.sectionTabPressCntnr === 0){
                cmdStringArr.pop();
                this.updateTabState(0, this.getCursorPosition(), rootArg);



                rootArg = Constants.EMPTY_STRING;
                cmdString = 'cp  ';
                this.firstSection = false;
                this.secondSection = true;
                this.dirEntryTraverseCntr = 0;
                // reset
                this.fetchedDirectoryList = [];

                const cursorPos = this.getCursorPosition();
                this.createTabState(cursorPos, 1);

              }else{
                rootArg  =  cmdStringArr[2];
                this.updateTabState(1, this.getCursorPosition(), rootArg);
              }
              this.sectionTabPressCntnr++;
            }else{
              rootArg  =  cmdStringArr[1];
            }

            await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
          }
        }
      } else{
        if(!this.generatedArguments.includes(rootArg)){
          const autoCmpltReslt = this.getAutoCompelete(rootArg, this.generatedArguments);
          if(autoCmpltReslt.length >= 1){
            this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
          }
          
        }
      }
      evt.preventDefault();
    }else{
      this.isInLoopState = false;
    }
  }


  async handleChangeDirectoryRequest(cmdString: string, rootCmd: string, rootArg: string): Promise<void> {
      if (this.isValidInputArg(rootArg)) {
          const alteredRootArg = this.getLastSegment(rootArg);
          console.log('alteredRootArg:', alteredRootArg);

          if (!this.isInLoopState) {
              console.log('Processing outside loop state');
              await this.processDirectoryTraversal(cmdString, rootCmd, rootArg, alteredRootArg);
          } else {
              console.log('Processing inside loop state');
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
      if (!this.fetchedDirectoryList.includes(alteredRootArg)) {
          console.log('Directory list does not contain:', alteredRootArg);
          const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
          await this.traverseDirectoryHelper(terminalCommand);
      } else {
          console.log('Directory list contains:', alteredRootArg);
      }
      this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, alteredRootArg);
      this.isInLoopState = true;
  }

  /** Processes section-based directory traversal */
  private async processSection(rootCmd: string, rootArg: string, alteredRootArg: string): Promise<void> {
      if (this.firstSection && this.firstSectionCntr === 0) {
          await this.processSpecificSection(0, rootCmd, rootArg, alteredRootArg);
      } else if (this.secondSection && this.secondSectionCntr === 0) {
          await this.processSpecificSection(1, rootCmd, rootArg, alteredRootArg);
      } else {
          this.loopThroughDirectory(rootCmd, rootArg, alteredRootArg);
          console.log('Updated dirEntryTraverseCntr:', this.dirEntryTraverseCntr);
      }
  }

  /** Processes a specific section */
  private async processSpecificSection(sectionIndex: number, rootCmd: string, rootArg: string, alteredRootArg: string): Promise<void> {
      if (sectionIndex === 0) this.firstSectionCntr--;
      else this.secondSectionCntr--;

      const alteredCmdString = `lx ${this.removeCurrentDir(rootArg)}`;
      console.log('alteredCmdString:', alteredCmdString);
      const terminalCommand = new TerminalCommand(alteredCmdString, 0, Constants.BLANK_SPACE);

      await this.traverseDirectoryHelper(terminalCommand);
      this.loopThroughDirectory(rootCmd, rootArg, alteredRootArg);
      this.dirEntryTraverseCntr = this.tabCompletionState.sections[sectionIndex].dirEntryTraverseCntr;
  }

  /** Handles cases where rootArg is empty */
  private async handleEmptyRootArg(cmdString: string, rootCmd: string, rootArg: string): Promise<void> {
      if (this.fetchedDirectoryList.length === 0) {
          console.log('Handling empty directory list');
          const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
          await this.traverseDirectoryHelper(terminalCommand);
          this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, "");
          this.isInLoopState = true;
      } else {
          await this.handleLoopState(rootCmd, rootArg);
      }
  }

  /** Handles loop state logic */
  private async handleLoopState(rootCmd: string, rootArg: string): Promise<void> {
      if (this.isInLoopState) {
          console.log('Handling loop state');
          this.updateTerminalForm(rootCmd, rootArg);
          this.dirEntryTraverseCntr++;
      } else {
          console.log('Handling directory loop');
          this.loopThroughDirectory(rootCmd, rootArg, '');
      }
  }

  /** Updates the terminal form based on rootArg */
  private updateTerminalForm(rootCmd: string, rootArg: string): void {
      const firstPath = this.fetchedDirectoryList[0];

      if (rootArg.includes(Constants.ROOT)) {
          console.log('setValue - 1');
          if (this.currentState === this.stateOne) {
              this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${firstPath}` });
          } else {
              this.updateMultiSectionPath(rootCmd, rootArg, firstPath);
          }
      } else {
          console.log('setValue - 2');
          if (this.currentState === this.stateOne) {
              this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${firstPath}` });
          } else {
              this.updateMultiSectionPath(rootCmd, rootArg, firstPath);
          }
      }
  }

  /** Updates multi-section paths */
  private updateMultiSectionPath(rootCmd: string, rootArg: string, firstPath: string): void {
      if (this.firstSection) {
          this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${firstPath} ${this.tabCompletionState.sections[1].currentPath}` });
      }
      if (this.secondSection) {
          this.terminalForm.setValue({ terminalCmd: `${rootCmd} ${this.tabCompletionState.sections[0].currentPath} ${firstPath}` });
      }
  }

  loopThroughDirectory(rootCmd:string, rootArg:string,  alteredRootArg:string):void{

    //const cnt = this.countSlashes(rootArg);
    //console.log('cnt:',cnt);
    console.log(`loopThroughDirectory:rootArg:${rootArg}`)
    console.log(`loopThroughDirectory:alteredRootArg:${alteredRootArg}`)
    console.log('traversalDepth:',this.directoryTraversalDepth);

    const curNum = this.dirEntryTraverseCntr++;
    console.log('dirEntryTraverseCntr:',this.dirEntryTraverseCntr);

    if((this.directoryTraversalDepth > 1)){
      console.log('11111111');
      console.log('setValue - 3');

      if(this.countSlahesInPath(rootArg) <= 1){
        if(!this.checkForCharAfterSlashRegex(rootArg)){
          rootArg = this.stripAfterSlash(rootArg);
        }
      }
        

      if(this.currentState === this.stateOne){
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${this.fetchedDirectoryList[curNum]}`});
      }else{
        if(this.firstSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${this.fetchedDirectoryList[curNum]} ${this.tabCompletionState.sections[1].currentPath} `});
  
        if(this.secondSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.tabCompletionState.sections[0].currentPath} ${this.removeCurrentDir(rootArg)}${this.fetchedDirectoryList[curNum]}`});
      }


    }else if(this.directoryTraversalDepth >= 0 && this.directoryTraversalDepth <= 1){
      console.log('22222222');
      console.log('setValue - 4');

      if(this.currentState === this.stateOne){
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.fetchedDirectoryList[curNum]}`});
      }else{
        if(this.firstSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.fetchedDirectoryList[curNum]} ${this.tabCompletionState.sections[1].currentPath}`});
  
        if(this.secondSection)
          this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.tabCompletionState.sections[0].currentPath} ${this.fetchedDirectoryList[curNum]}`});
      }
    }

    if(this.dirEntryTraverseCntr > this.fetchedDirectoryList.length - 1){
      this.dirEntryTraverseCntr = 0;
    }
  }

  evaluateChangeDirectoryRequest(cmdString:string, rootCmd:string, rootArg:string, alteredRootArg:string):boolean{
    console.log('ecdr-cmdString:',cmdString);
    console.log('ecdr-rootCmd:',rootCmd);
    console.log('ecdr-rootArg:',rootArg);
    console.log('ecdr-alteredRootArg:',alteredRootArg);
    const autoCmpltReslt = this.getAutoCompelete(alteredRootArg, this.fetchedDirectoryList);
    let result = false;
    if(autoCmpltReslt.length === 1){
      if((rootArg.includes(Constants.ROOT) && rootArg !== this.haveISeenThisRootArg) &&  (this.haveISeenThisAutoCmplt !== autoCmpltReslt[0])){
        console.log('1- I AM STILL NEEDED 001');
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`});
        this.haveISeenThisRootArg = `${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`
        this.haveISeenThisAutoCmplt = autoCmpltReslt[0];
      }else if(!rootArg.includes(Constants.ROOT)){
        console.log('2 - I AM STILL NEEDED 0002');
        this.haveISeenThisAutoCmplt = autoCmpltReslt[0];
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
      }
      result = true;
    }else if(autoCmpltReslt.length > 1){
      console.log('3 - I AM STILL NEEDED 00003');
      const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = autoCmpltReslt.join(Constants.BLANK_SPACE);
      this.commandHistory.push(terminalCommand);
      result = true;
    }else{
      console.log('3 - I AM STILL NEEDED 00004');
      const terminalCommand = new TerminalCommand(cmdString, 0, Constants.BLANK_SPACE);
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = this.fetchedDirectoryList.join(Constants.BLANK_SPACE);
      this.commandHistory.push(terminalCommand);
      result = true;
    }

    return result
  }

  removeCurrentDir(arg0:string):string{

    /**
     * give an input like Document/, Games/Data/In/, Documents/Sample, Games/FlashGames/Moz, ABC/DEF/HIJ/KlM/, ABC/DEF/HIJ/KlM/NO
     * return Document/, Games/Data/, Documents, Games/FlashGames/, ABC/DEF/HIJ/, ABC/DEF/HIJ/KlM/
     */
    let result = Constants.EMPTY_STRING;

    if(this.isWhiteSpaceAtTheEnd)
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

  resetValues():void{
    this.firstSection = true;
    this.secondSection = false;
    this.sectionTabPressCntnr = 0;
    this.firstSectionCntr = -1;
    this.secondSectionCntr = -1;
    this.currentState =  this.stateOne;
    this.swtichToNextSection = false;
    this.fetchedDirectoryList = [];
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

      this.prevPtrIndex = currPtrIndex;
      (currPtrIndex === this.commandHistory.length) ? 
        this.terminalForm.setValue({terminalCmd:''}) : 
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
    return  !arg.replace(/\s/g, '').length;
  }

  async traverseDirectoryHelper(terminalCmd:TerminalCommand):Promise<void>{
    const cmdStringArr = terminalCmd.getCommand.split(Constants.BLANK_SPACE);
    //const rootCmd = cmdStringArr[0].toLowerCase();
    let path = '';

    if(this.firstSection)
        path = cmdStringArr[1];
    else{
      path = cmdStringArr[2];
    }

    const str = 'string';
    const strArr = 'string[]';

    const result = await this._terminaCommandsProc.traverseDirectory(path);

    if(result.type === str || result.type === strArr)
      terminalCmd.setResponseCode = this.Success;

    if(result.type === str){
      terminalCmd.setCommandOutput = result.result;
      this.doesDirExist = false;
      this.directoryTraversalDepth = result.depth;
    }
    else if(result.type === strArr){
      this.fetchedDirectoryList = [];
      this.dirEntryTraverseCntr = 0;
      this.fetchedDirectoryList = [...result.result as string[]];
      this.doesDirExist = true;
      this.directoryTraversalDepth = result.depth;
    }

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
  }

  async processCommand(terminalCmd:TerminalCommand, key=""):Promise<void>{
    const cmdStringArr = terminalCmd.getCommand.split(Constants.BLANK_SPACE);
    const rootCmd = cmdStringArr[0].toLowerCase();

    if(this.isValidCommand(rootCmd)){

      if(rootCmd == "cat"){
        const result = await this._terminaCommandsProc.cat(terminalCmd.getCommand);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result.response;
      }

      if(rootCmd == "cd"){
        const result = await this._terminaCommandsProc.cd(cmdStringArr[1]);

        if(result.result){
          terminalCmd.setResponseCode = this.Success;
          terminalCmd.setCommandOutput = result.response;
        }else{
          terminalCmd.setResponseCode = this.Fail;
          terminalCmd.setCommandOutput = result.response;
        }
      } 

      if(rootCmd == "clear"){
        this.commandHistory = [];
        this.isBannerVisible = false;
        this.isWelcomeVisible = false;
      } 

      if(rootCmd == "close"){
        const result = this._terminaCommandsProc.close(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if (rootCmd == "cp"){
        const option = cmdStringArr[1];
        const source = cmdStringArr[2];
        const destination = cmdStringArr[3];
      
        const result = await this._terminaCommandsProc.cp(option, source, destination);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }

      if(rootCmd == "curl"){
        const result = await this._terminaCommandsProc.curl(cmdStringArr);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "date"){
        const result = this._terminaCommandsProc.date();
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "download"){
        const result = await this._terminaCommandsProc.download(cmdStringArr[1], cmdStringArr[2], cmdStringArr[3]);
        terminalCmd.setResponseCode = (result.result)? this.Success : this.Fail;
        terminalCmd.setCommandOutput = result.response;
      } 

      if(rootCmd == "exit"){
        this._terminaCommandsProc.exit(this.processId);
      } 

      if(rootCmd == "help"){
        const result = this._terminaCommandsProc.help(this.echoCommands, this.utilityCommands, cmdStringArr[1]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "list"){
        const result = this._terminaCommandsProc.list(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "ls"){
        const str = 'string';
        const strArr = 'string[]';
        const result = await this._terminaCommandsProc.ls(cmdStringArr[1]);
        terminalCmd.setResponseCode = this.Success;


        if(result.type === str){
          terminalCmd.setCommandOutput = result.result;
          this.doesDirExist = false;
        }
        else if(result.type === strArr){
          console.log('ls result:', result)
          terminalCmd.setCommandOutput = result.result.join(Constants.BLANK_SPACE);
          this.fetchedDirectoryList = [];
          this.fetchedDirectoryList = [...result.result];
        }
      } 

      if(rootCmd == "mkdir"){
        const result = await this._terminaCommandsProc.mkdir(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }

      if(rootCmd == "mv"){
        const result = await this._terminaCommandsProc.mv(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }

      if(rootCmd == "open"){
        const result = this._terminaCommandsProc.open(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "pwd"){
        const result = this._terminaCommandsProc.pwd();
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "rm"){
        const result = await this._terminaCommandsProc.rm(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }

      if(rootCmd == "touch"){
        const result = await this._terminaCommandsProc.touch(cmdStringArr[1]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result.response;
      }

      if(rootCmd == "version"){
        const result = this._terminaCommandsProc.version(this.versionNum);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "whoami"){
        const result = this._terminaCommandsProc.whoami();
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "weather"){
        const result = await this._terminaCommandsProc.weather(cmdStringArr[1]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

    }else{
      terminalCmd.setResponseCode = this.Fail;
      terminalCmd.setCommandOutput = `${terminalCmd.getCommand}: command not found. Type 'help', or 'help -verbose' to view a list of available commands.`;
    }

    setTimeout(() => this.scrollToBottom(), this.SCROLL_DELAY);
    this.storeAppState();
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
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();
      const mainWindow = document.getElementById('vanta');
      //window title and button bar, terminal input section, windows taskbar height 
      let pixelTosubtract = 30 + 25 + 40;
      this.terminalOutputCntnr.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      this.terminalOutputCntnr.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;

      if(this.isBannerVisible && this.isWelcomeVisible){
        // bannerVisible (28) + welcomeVisible(27)
        pixelTosubtract += 55;
      }
      this.terminalHistoryOutput.nativeElement.style.width = `${mainWindow?.offsetWidth}px`;
      this.terminalHistoryOutput.nativeElement.style.height = `${(mainWindow?.offsetHeight || 0) - pixelTosubtract}px`;
    }
  }

  minimizeWindow(arg:number[]):void{
    const uid = `${this.name}-${this.processId}`;
    const evtOriginator = this._runningProcessService.getEventOrginator();

    if(uid === evtOriginator){
      this._runningProcessService.removeEventOriginator();

      this.terminalOutputCntnr.nativeElement.style.width = `${arg[0]}px`;
      this.terminalOutputCntnr.nativeElement.style.height = `${arg[1]}px`;

      this.terminalHistoryOutput.nativeElement.style.width = `${arg[0]}px`;
      this.terminalHistoryOutput.nativeElement.style.height = `${arg[1]}px`;
    }
  }

  setTerminalWindowToFocus(pid:number):void{
    this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  storeAppState():void{
    const cmdHistory = this.commandHistory;
    const cmdList:string[] = [];
    const uid = `${this.name}-${this.processId}`;

    for(let i = 0; i < cmdHistory.length; i++){
      cmdList.push(cmdHistory[i].getCommand);
    }

    this._appState = {
      pid: this.processId,
      app_data: cmdList,
      app_name: this.name,
      unique_id: uid,
      window: {app_name:'', pid:0, x_axis:0, y_axis:0, height:0, width:0, z_index:0, is_visible:true}
    }

    this._sessionManagmentService.addAppSession(uid, this._appState);
  }

  async onDrop(event:DragEvent):Promise<void>{
    this._runningProcessService.addEventOriginator(this.name);
    //Some about z-index is causing the drop to desktop to act funny.
    event.preventDefault();
    let droppedFiles:File[] = [];

    if(event?.dataTransfer?.files){
        // eslint-disable-next-line no-unsafe-optional-chaining
        droppedFiles  = [...event?.dataTransfer?.files];
    }
    
    if(droppedFiles.length >= 1){
      console.log('Terminal onDrop:', droppedFiles);
    }   
  }

  retrievePastSessionData():void{
    const appSessionData = this._sessionManagmentService.getAppSession(this.priorUId);
    if(appSessionData !== null && appSessionData.app_data != Constants.EMPTY_STRING){
        const terminalCmds =  appSessionData.app_data as string[];
        for(let i = 0; i < terminalCmds.length; i++){
          const cmd = new TerminalCommand(terminalCmds[i], 0, Constants.EMPTY_STRING);
          this.commandHistory.push(cmd);
        }
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
