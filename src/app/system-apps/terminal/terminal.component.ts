import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { TerminalCommand } from './model/terminal.command';
import { TerminalCommandProcessor } from './terminal.commands';
import { AppState, BaseState } from 'src/app/system-files/state/state.interface';
import { StateType } from 'src/app/system-files/state/state.type';
import { StateManagmentService } from 'src/app/shared/system-service/state.management.service';
import { SessionManagmentService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';
import * as htmlToImage from 'html-to-image';
import { TaskBarPreviewImage } from '../taskbarpreview/taskbar.preview';

@Component({
  selector: 'cos-terminal',
  templateUrl: './terminal.component.html',
  styleUrls: ['./terminal.component.css']
})
export class TerminalComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy{

  @ViewChild('terminalCntnr', {static: true}) terminalCntnr!: ElementRef;
  @ViewChild('terminalOutputCntnr', {static: true}) terminalOutputCntnr!: ElementRef;
  @ViewChild('terminalHistoryOutput', {static: true}) terminalHistoryOutput!: ElementRef;

  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _maximizeWindowSub!: Subscription;
  private _minimizeWindowSub!: Subscription;
  private _formBuilder;
  private _terminaCommandsProc!:TerminalCommandProcessor;
  private _stateManagmentService:StateManagmentService;
  private _sessionManagmentService: SessionManagmentService;
  private _appState!:AppState;
  private _consts:Constants = new Constants();

  private msgPosCounter = 0;
  private scrollCounter = 0
  private prevPtrIndex = 0;
  private versionNum = '1.0.4';
  private SECONDS_DELAY:number[] = [120,250];
  private doesDirExist = true;
  private isInLoopState = false;
  private isWhiteSpaceAtTheEnd = false;
  
  Success = 1;
  Fail = 2;
  Warning = 3;
  Options = 4;

  isBannerVisible = true;
  isWelcomeVisible = true;

  banner = '';
  welcomeMessage = '';
  terminalPrompt = ">";
  commandHistory:TerminalCommand[] = [];
  echoCommands:string[] = ["close", "curl","date", "echo", "help", "hostname", "list", "open", "version", "whoami", "weather","pwd"];
  utilityCommands:string[] = ["all", "cat", "cd", "clear", "cp", "dir", "download","exit", "ls", "mkdir", "mv", "rm","touch"];
  fetchedDirectoryList:string[] = [];
  generatedArguments:string[] = [];
  allCommands:string[] = [];
  haveISeenThisRootArg = '';
  haveISeenThisAutoCmplt = '';

  terminalForm!: FormGroup;
  numCntr = 0;
  traversalDepth = 0;

  hasWindow = true;
  icon = `${this._consts.IMAGE_BASE_PATH}terminal.png`;
  name = 'terminal';
  processId = 0;
  type = ComponentType.System;
  displayName = 'Terminal';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, formBuilder:FormBuilder,
               stateManagmentService: StateManagmentService, sessionManagmentService: SessionManagmentService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._formBuilder = formBuilder;
    this._stateManagmentService = stateManagmentService;
    this._sessionManagmentService = sessionManagmentService;
    this._terminaCommandsProc = new TerminalCommandProcessor();

    this.retrievePastSessionData();

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail()); 
    this._maximizeWindowSub = this._runningProcessService.maximizeProcessWindowNotify.subscribe(() =>{this.maximizeWindow()})
    this._minimizeWindowSub = this._runningProcessService.minimizeProcessWindowNotify.subscribe((p) =>{this.minimizeWindow(p)})
  }

  ngOnInit():void{
    this.terminalForm = this._formBuilder.nonNullable.group({
      terminalCmd: '',
    });

    this.banner = this.getTerminalBanner();
    this.allCommands = [...this.echoCommands, ...this.utilityCommands];
  }

  ngAfterViewInit():void{
    this.setTerminalWindowToFocus(this.processId); 
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
        imageData: htmlImg
      }
      this._runningProcessService.addProcessImage(this.name, cmpntImg);
    })
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
    const msgArr :string[] = welcomeMessage.split(" ");

    const interval =  setInterval((msg) => {
      let tmpCounter = 0;
      for(let i = 0; i < msg.length; i++){
        if (tmpCounter < 1){
          this.welcomeMessage +=(this.msgPosCounter == 0)? msg[this.msgPosCounter]:  " " + msg[this.msgPosCounter];
          tmpCounter++;
        }
      }

      if(this.msgPosCounter == msg.length - 1)
        clearInterval(interval);

      this.msgPosCounter++;
    },this.SECONDS_DELAY[0], msgArr);
  }

  onKeyDownOnWindow(evt:KeyboardEvent):void{
    this.focusOnInput();
    if (evt.key === "Tab") {
      // Prevent tab from moving focus
      evt.preventDefault();
    }
  }

  focusOnInput():void{
    const cmdTxtBoxElm= document.getElementById('cmdTxtBox') as HTMLInputElement;
    if(cmdTxtBoxElm){
      cmdTxtBoxElm?.focus();
    }
  }

  private scrollToBottom(): void {

    const interval =  setInterval(() => {
      try {
        //console.log('height:',this.terminalOutputCntnr.nativeElement.scrollHeight);
        if(this.scrollCounter < 2){
          this.terminalOutputCntnr.nativeElement.scrollTop = this.terminalOutputCntnr.nativeElement.scrollHeight;
          this.scrollCounter++;
        }
        
      } catch (err) {
        console.error('Error scrolling to bottom:', err);
      }
      if(this.scrollCounter == 2) {
        clearInterval(interval);
        this.scrollCounter = 0;
      }

    },this.SECONDS_DELAY[1]);
  }

  async onKeyDoublePressed(evt: KeyboardEvent): Promise<void> {
    console.log(`${evt.key} Key pressed  rapidly.`);
  }

  async onKeyDownInInputBox(evt:KeyboardEvent):Promise<void>{
   
    if(evt.key == "Enter"){
      //this.isInLoopState = false;
      this.numCntr = 0;

      const cmdInput = this.terminalForm.value.terminalCmd as string;
      const terminalCommand = new TerminalCommand(cmdInput, 0, '');

      if(cmdInput !== ''){
        this.processCommand(terminalCommand, "Enter");
        this.commandHistory.push(terminalCommand);
        this.prevPtrIndex = this.commandHistory.length;
        this.terminalForm.reset();
      }
      evt.preventDefault();
    }else if(evt.key == "ArrowUp"){
      this.getCommandHistory("backward");
      evt.preventDefault();
    }else if(evt.key == "ArrowDown"){
      this.getCommandHistory("forward")
      evt.preventDefault();
    }else  if(evt.key == "Tab"){
      const cmdString = this.terminalForm.value.terminalCmd as string;
      const cmdStringArr =(cmdString === undefined)? '': cmdString.split(" ");
      const rootCmd = cmdStringArr[0];
      let rootArg = ''
 
      //console.log('rootCmd:',rootCmd);
      /**
       * the command part of the command string, can not be undefined, must have a length greater than 0, and cannot contain space
       */
      if(rootCmd !== undefined && rootCmd.length > 0 && !rootCmd.includes(" ")){
        if(!this.allCommands.includes(rootCmd)){

          const autoCmpltReslt = this.getAutoCompelete(rootCmd, this.allCommands);

          if(autoCmpltReslt.length === 1){
            this.terminalForm.setValue({terminalCmd: autoCmpltReslt[0]});
          }if(autoCmpltReslt.length > 1){
            const terminalCommand = new TerminalCommand(cmdString, 0, " ");
            terminalCommand.setResponseCode = this.Options;
            terminalCommand.setCommandOutput = autoCmpltReslt.join(" ");
            this.commandHistory.push(terminalCommand);
          }

        }
      }

      //console.log('rootArg:',rootArg);
      if(rootCmd == "cd" || rootCmd == "rm"){
        rootArg  =  cmdStringArr[1];
        this.isWhiteSpaceAtTheEnd = this.checkForWhitSpaceAtTheEnd(cmdString);
        console.log('Has-White-Space-At-The- sEnd:', this.isWhiteSpaceAtTheEnd);

        if(rootArg === undefined){
          const whiteSpace = ' ';
          this.terminalForm.setValue({terminalCmd:`${rootCmd} ${whiteSpace}`});
        }

        await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
      }else if(rootCmd == "cp" || rootCmd == "mv"){
        // const optionA = cmdStringArr[1];
        // const optionB = cmdStringArr[2];
        // const source = cmdStringArr[3];
        // const destination = cmdStringArr[4];

        //this.shiftRight(rootCmd,optionA,optionB,source,destination);
        
        //await this.handleChangeDirectoryRequest(cmdString,rootCmd,rootArg);
      } else{
        if(!this.generatedArguments.includes(rootArg)){
          const autoCmpltReslt = this.getAutoCompelete(rootArg, this.generatedArguments);
          if(autoCmpltReslt.length === 1){
            this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
          }else{
            const terminalCommand = new TerminalCommand(cmdString, 0, " ");
            terminalCommand.setResponseCode = this.Options;
            terminalCommand.setCommandOutput = autoCmpltReslt.join(" ");
            this.commandHistory.push(terminalCommand);
          }
        }
      }
      evt.preventDefault();
    }else{
      this.isInLoopState = false;
    }
  }

  async handleChangeDirectoryRequest(cmdString:string, rootCmd:string, rootArg:string):Promise<void>{
    if(rootArg !== undefined && rootArg.length > 0 && !rootArg.includes(" ")){
      const alteredRootArg = this.getLastSegment(rootArg);
      console.log('alteredRootArg:',alteredRootArg);


      if(!this.isInLoopState){
        console.log('i am now here');
        if(!this.fetchedDirectoryList.includes(alteredRootArg)){
          console.log('fetchedDirectoryList does not have:',alteredRootArg );
          const terminalCommand = new TerminalCommand(cmdString, 0, " ");
          await this.processCommand(terminalCommand).then(() =>{
            this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, alteredRootArg);
            this.isInLoopState = true;
            this.numCntr = 0;
          });
        }else{
          console.log('fetchedDirectoryList does have:',alteredRootArg );
          this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, alteredRootArg);
          this.isInLoopState = true;
        }
      }else{
        console.log('i am now here 1');
        this.loopThroughDirectory(rootCmd,rootArg, alteredRootArg);
        console.log('this.numCntr++:', this.numCntr);
      }

    }else{
      //console.log('rootArg:',rootArg);
      if(this.fetchedDirectoryList.length == 0){

        console.log('i am now here 2');
        const terminalCommand = new TerminalCommand(cmdString, 0, " ");
        await this.processCommand(terminalCommand).then(() =>{
          this.evaluateChangeDirectoryRequest(cmdString, rootCmd, rootArg, "");
          this.isInLoopState = true;
        });
      }else{
        if(this.isInLoopState){
          console.log('i am now here 4');

          if(rootArg.includes('/')){
            this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${this.fetchedDirectoryList[0]}`});
          }else{
            this.terminalForm.setValue({terminalCmd:`${rootCmd} ${this.fetchedDirectoryList[0]}`});
          }

          this.numCntr++;
        }else{
          console.log('i am now here 5');
          this.loopThroughDirectory(rootCmd,rootArg, '');
        }
      }
    }
  }

  loopThroughDirectory(rootCmd:string, rootArg:string,  alteredRootArg:string):void{

    //const cnt = this.countSlashes(rootArg);
    //console.log('cnt:',cnt);
    console.log(`loopThroughDirectory:rootArg:${rootArg}`)
    console.log(`loopThroughDirectory:alteredRootArg:${alteredRootArg}`)
    console.log('traversalDepth:',this.traversalDepth);

    const curNum = this.numCntr++;

    if((this.traversalDepth > 1)){
      console.log('11111111');
      this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${this.fetchedDirectoryList[curNum]}`});
    }else if(this.traversalDepth >= 0 && this.traversalDepth <= 1){
      console.log('22222222');
      this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.fetchedDirectoryList[curNum]}`});
    }

    if(this.numCntr > this.fetchedDirectoryList.length - 1){
      this.numCntr = 0;
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
      if((rootArg.includes('/') && rootArg !== this.haveISeenThisRootArg) &&  (this.haveISeenThisAutoCmplt !== autoCmpltReslt[0])){
        console.log('1- I AM STILL NEEDED 001');
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`});
        this.haveISeenThisRootArg = `${this.removeCurrentDir(rootArg)}${autoCmpltReslt[0]}`
        this.haveISeenThisAutoCmplt = autoCmpltReslt[0];
      }else if(!rootArg.includes('/')){
        console.log('2 - I AM STILL NEEDED 0002');
        this.haveISeenThisAutoCmplt = autoCmpltReslt[0];
        this.terminalForm.setValue({terminalCmd: `${rootCmd} ${autoCmpltReslt[0]}`});
      }
      result = true;
    }else if(autoCmpltReslt.length > 1){
      console.log('3 - I AM STILL NEEDED 00003');
      const terminalCommand = new TerminalCommand(cmdString, 0, " ");
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = autoCmpltReslt.join(" ");
      this.commandHistory.push(terminalCommand);
      result = true;
    }else{
      const terminalCommand = new TerminalCommand(cmdString, 0, " ");
      terminalCommand.setResponseCode = this.Options;
      terminalCommand.setCommandOutput = this.fetchedDirectoryList.join(" ");
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
    let result = '';

    if(this.isWhiteSpaceAtTheEnd)
        return arg0;

    if(arg0.includes('/')) {
      const argSplit = arg0.split('/').filter(x => x !== '');
      const res:string[] = [];

      if(argSplit.length === 1)
          return `${argSplit[0]}/`;
      else{
        argSplit.pop();

        for(let i = 0; i <= argSplit.length - 1; i++){
          res.push(`${argSplit[i]}/`);
        }
      }
      result = res.join('');
      //console.log('removeCurrentDir-result:',result);
    }

    return result.replace(',','');
  }

  getLastSegment(arg0:string):string{
    /**
     * give an input like Document/PD, Games/Data/In
     * return PD, In
     */
    const rootArgs = arg0.split('/');
    let rootArg = '';

    if(rootArgs.length === 1) {
      rootArg =  rootArgs[0];
    }else if (rootArgs.length >1){

      if(rootArgs.slice(-1)[0] !== ''){
         rootArg = rootArgs.slice(-1)[0];
      }else{
        rootArg = rootArgs.slice(-2)[0];
      }
    }

    return rootArg;
  }

  checkForWhitSpaceAtTheEnd(arg0:string):boolean {
    const whitespaceChars = [' ', '\t', '\n'];
    return whitespaceChars.some(char => arg0.slice(-1).includes(char));
  }

  countSlashes(input: string): number {
    const matches = input.match(/\//g);
    return matches ? matches.length : 0;
  }

  shiftRight(...params:string[]):void{

    const noUndefineds = params.filter(x => x !==undefined);
    console.log(`params:${noUndefineds}`);

    //get rootCmd
    const rootCmd = noUndefineds[0];
    let optionA = undefined;
    let optionB = undefined
    let src = undefined;
    let dest = undefined
    noUndefineds.shift();

    for(const el of noUndefineds){
      if(this.isOption(el)){
        if(!optionA  && !optionB){
          optionA = el;
        }else if(optionA && !optionB){
          optionB = el;
        }
      }else{
        if(!src  && !dest){
          src = el;
        }else if(src && !dest){
          dest = el;
        }
      }
    }

    console.log(`After --- optA:${optionA} optB:${optionB} src:${src} dest:${dest}`)
  }

  isOption(arg0:string):boolean{
    const firstChar = arg0[0];
    return (firstChar === '-')? true : false;
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

  async processCommand(terminalCmd:TerminalCommand, key=""):Promise<void>{
    const cmdStringArr = terminalCmd.getCommand.split(" ");
    const rootCmd = cmdStringArr[0].toLowerCase();
    if(this.isValidCommand(rootCmd)){

      if(rootCmd == "clear"){
        this.commandHistory = [];
        this.isBannerVisible = false;
        this.isWelcomeVisible = false;
      } 

      if(rootCmd == "curl"){
        const result = await this._terminaCommandsProc.curl(cmdStringArr);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "close"){
        const result = this._terminaCommandsProc.close(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "date"){
        const result = this._terminaCommandsProc.date();
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "download"){
        this._terminaCommandsProc.download(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = 'downloading ..';
      } 

      if(rootCmd == "exit"){
        this._terminaCommandsProc.exit(this.processId);
      } 

      if(rootCmd == "help"){
        const result = this._terminaCommandsProc.help(this.echoCommands, this.utilityCommands, cmdStringArr[1]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "open"){
        const result = this._terminaCommandsProc.open(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
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

      if(rootCmd == "list"){
        const result = this._terminaCommandsProc.list(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "pwd"){
        const result = this._terminaCommandsProc.pwd();
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      } 

      if(rootCmd == "cd"){
        const str = 'string';
        const strArr = 'string[]';
        const result = await this._terminaCommandsProc.cd(cmdStringArr[1], key);

        if(result.type === str || result.type === strArr)
          terminalCmd.setResponseCode = this.Success;
 
        if(result.type === str){
          terminalCmd.setCommandOutput = result.result;
          this.doesDirExist = false;
          this.traversalDepth = result.depth;
        }
        else if(result.type === strArr){
          this.fetchedDirectoryList = [];
          this.fetchedDirectoryList = [...result.result as string[]];
          this.doesDirExist = true;
          this.traversalDepth = result.depth;
        }
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
          terminalCmd.setCommandOutput = result.result.join(' ');
          this.fetchedDirectoryList = [];
          this.fetchedDirectoryList = [...result.result];
        }
      } 

      if(rootCmd == "mkdir"){
        const result = await this._terminaCommandsProc.mkdir(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }

      if(rootCmd == "rm"){
        const result = await this._terminaCommandsProc.rm(cmdStringArr[1], cmdStringArr[2]);
        terminalCmd.setResponseCode = this.Success;
        terminalCmd.setCommandOutput = result;
      }



      if(rootCmd == "mv"){
        const result = await this._terminaCommandsProc.mv(cmdStringArr[1], cmdStringArr[2]);
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
      
    }else{
      terminalCmd.setResponseCode = this.Fail;
      terminalCmd.setCommandOutput = `${terminalCmd.getCommand}: command not found. Type 'help', or 'help -verbose' to view a list of available commands.`;
    }

    this.scrollToBottom();
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
    this._runningProcessService.focusOnCurrentProcessNotify.next(pid);
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
      unique_id: uid
    }

    this._stateManagmentService.addState(uid, this._appState, StateType.App);
  }

  retrievePastSessionData():void{
    const pickUpKey = this._sessionManagmentService._pickUpKey;
    if(this._sessionManagmentService.hasTempSession(pickUpKey)){
      const tmpSessKey = this._sessionManagmentService.getTempSession(pickUpKey) || ''; 
      const retrievedSessionData = this._sessionManagmentService.getSession(tmpSessKey) as BaseState[];

      if(retrievedSessionData !== undefined){
        const appSessionData = retrievedSessionData[0] as AppState;
        if(appSessionData !== undefined  && appSessionData.app_data != ''){
  
          const terminalCmds =  appSessionData.app_data as string[];
          for(let i = 0; i < terminalCmds.length; i++){
            const cmd = new TerminalCommand(terminalCmds[i], 0, '');
            this.commandHistory.push(cmd);
          }
        }
      }
    }
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
