// appName tag carried on InformationUpdate so that only the originating terminal
// picks up live progress updates routed through SystemNotificationService. The
// command's unique id is used as the routing key (carried in InformationUpdate.pId).
// Producer (TerminalCommandProcessor) and consumer (TerminalComponent) share this.
export const TERMINAL_OUTPUT_APP_NAME = 'terminalOutput';

export class TerminalCommand {
    private static _nextCommandID = 1000;
    private _command: string;
    private _responseCode:number;
    private _commandOutput: string;
    private _commandID: number;

    constructor(cmd:string, respCode = 0, cmdOutput:string ){
        this._command = cmd;
        this._responseCode = respCode;
        this._commandOutput = cmdOutput;
        this._commandID = this.generateCommandID();
    }

    get getCommand(){
        return this._command;
    }
    set setCommand(cmd:string){
         this._command = cmd;
    }

    get getResponseCode(){
        return this._responseCode;
    }
    set setResponseCode(respCode:number){
        this._responseCode= respCode
    }

    get getCommandOutput(){
        return this._commandOutput;
    }
    set setCommandOutput(cmdOutput:string){
        this._commandOutput = cmdOutput;
    }

    get getCommandID(){
        return this._commandID;
    }

   private generateCommandID():number{
        return TerminalCommand._nextCommandID++;
    }
}

export interface  IState{
    cursorPosition: number,
    indexSection:number,
    dirEntryTraverseCntr:number,
    currentPath:string
}

export interface  ITabState{
    sections:IState[]
}

export interface  ITraverseResult{
    type: string,  
    result: any, 
    depth:number
}

export interface LSResult{
    type: string;  
    result: any;
}

export interface GenericResult{
    response: string;  
    result: boolean;
}



/**
 * Narrow view of the TerminalComponent that the router is allowed to touch.
 *
 * The router only needs to: read a handful of component constants/state,
 * ask whether a root command is known, and push three specific side-effects
 * back onto the component (clear the screen, and the two pieces of state the
 * `ls` command updates). Exposing just these keeps the component's private
 * fields private while still letting the dispatch live in its own file.
 */
export interface ITerminalCommandHost {
  /** Response codes mirrored from the component (1/2/4). */
  readonly Success: number;
  readonly Fail: number;
  readonly Options: number;

  /** Owning terminal's process id (used by `exit`). */
  readonly processId: number;

  /** Version string shown by the `version` command. */
  readonly versionNum: string;

  /** Command name lists used to build the `help` output. */
  readonly echoCommands: string[];
  readonly utilityCommands: string[];

  /** Gate used to reject unknown root commands. */
  isValidCommand(cmd: string): boolean;

  /** `clear` — wipe history and hide the banner / welcome message. */
  clearScreen(): void;

  /** `ls` — record whether the listed path was a directory. */
  setDoesDirExist(exists: boolean): void;

  /** `ls` — cache the fetched directory listing for tab-completion. */
  setFetchedDirectoryList(list: string[]): void;
}