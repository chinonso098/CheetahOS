import { GenericResult, ITraverseResult, LSResult, TerminalCommand, TERMINAL_OUTPUT_APP_NAME } from "./model/terminal.types";
import { AppDirectory } from "src/app/system-files/app.directory";

import { FileService } from "src/app/shared/system-service/file.service";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { RunningProcessService } from "src/app/shared/system-service/running.process.service";
import { SystemNotificationService } from "src/app/shared/system-service/system.notification.service";
import { WindowService } from "src/app/shared/system-service/window.service";
import { DefaultService } from "src/app/shared/system-service/defaults.services";
import { SessionManagementService } from "src/app/shared/system-service/session.management.service";
import { InformationUpdate } from "src/app/system-files/commons/common.interfaces";

import { FileInfo } from "src/app/system-files/fs/file.info";
//import {extname, basename, resolve, dirname} from 'path';
import { Constants } from 'src/app/system-files/constants';
//import { ActivityType } from "src/app/system-files/common.enums";
import { CommonFunctions } from "src/app/system-files/commons/common.functions";
import { ActivityHistoryService } from "src/app/shared/system-service/activity.tracking.service";
import { SystemMetricService } from "src/app/shared/system-service/system.metrics.sservice";


export interface OctalRepresentation {
    symbolic:string;
    binary: number;
    permission: string;
}

export class TerminalCommandProcessor{

    private _processHandlerService!:ProcessHandlerService;
    private _runningProcessService!:RunningProcessService;
    private _activityHistoryService!:ActivityHistoryService;
    private _systemMetric!:SystemMetricService;
    private _systemNotificationService!:SystemNotificationService;
    private _windowService!:WindowService;
    private _defaultService!:DefaultService;
    private _sessionManagementService!:SessionManagementService;

    private _fileService!:FileService;
    private _appDirctory = new AppDirectory();
  
    
    private  permissionChart!:Map<number, OctalRepresentation>;
    private closingNotAllowed:string[] = ["system", "desktop", "filemanager", "taskbar", "startbutton", "clock", "taskbarentry", "startmenu","volume", "search",
        "cmpnt_ref_svc", "file_mgr_svc", "file_svc", "menu_svc", "notification_svc", "pid_gen_svc", "rning_proc_svc", "scripts_svc",
        "session_mgmt_svc", "state_mgmt_svc","trgr_proc_svc", "window_mgmt_svc",  "audio_svc", "activity_tracking_svc", "file_indexing_svc"];

    private falseDirectories:string[] = ["3D-Objects", "Desktop", "Documents", "Downloads", "Games", "Music", "Pictures", "Videos"];
        
    private files:FileInfo[] = [];
    private readonly defaultDirectoryPath = Constants.ROOT;
    private currentDirectoryPath = Constants.ROOT;
    private fallBackDirPath = Constants.EMPTY_STRING;

    constructor(controlProcessService:ProcessHandlerService, runningProcessService:RunningProcessService, fileService:FileService,
                activityHistoryService:ActivityHistoryService, systemMetric:SystemMetricService, systemNotificationService:SystemNotificationService,
                windowService:WindowService, defaultService:DefaultService, sessionManagementService:SessionManagementService) { 
        this._processHandlerService = controlProcessService;
        this._runningProcessService = runningProcessService;
        this._activityHistoryService = activityHistoryService;
        this._systemMetric = systemMetric;
        this._systemNotificationService = systemNotificationService;
        this._windowService = windowService;
        this._defaultService = defaultService;
        this._sessionManagementService = sessionManagementService;

        this._fileService = fileService;
        this.permissionChart = new Map<number, OctalRepresentation>();
        this.genPermissionsRepresentation();
    }

    /**
     * Push a live progress line back to the terminal that issued the command.
     * Routed by commandID through SystemNotificationService; the originating
     * TerminalComponent updates the matching command's output in place.
     */
    private emitLiveOutput(commandID:number, output:string):void{
        const update:InformationUpdate = {pId:commandID, appName:TERMINAL_OUTPUT_APP_NAME, info:[output]};
        this._systemNotificationService.updateInformationNotify.next(update);
    }

    private formatBytes(bytes:number):string{
        if(bytes < 1024) return `${bytes} B`;
        const units = ['KB','MB','GB','TB'];
        let val = bytes / 1024;
        let i = 0;
        while(val >= 1024 && i < units.length - 1){ val /= 1024; i++; }
        return `${val.toFixed(1)} ${units[i]}`;
    }

    help(arg0:string[], arg1:string[],arg2:string):string{
        const cmdList =  [...arg0, ...arg1];
        const numPerLine = 10;

        if(arg2 == undefined || arg2.length == 0){
            const result:string[] = ['Available commands:'];
            for(let i = 0; i <= cmdList.length - 1; i += numPerLine){
                const chunk = cmdList.slice(i, i + numPerLine);
                result.push(...chunk)
                result.push('\n');
            }

            return result.join(' ');
        }

        if(arg2 == "-verbose"){
            const verbose = `
terminal <command>

Usage:

help                            get a list of available commands
help -verbose                   get a detailed list of commands 
open --app  <foo>               opens app <foo>
close --app <pId>               closes app <pid>
clear                           clears the terminal output and all previous command
curl                            query Api's
download <uri> <path> <name>    download from the internet by providing a urls
ls                              list files and folder in the present directory
cd                              change directory
cp  -<option> <path> <path>     copy from source to destination folder
mv  <path> <path>               move from source to destination folder
cat <file>                      open the contents 
touch <file>                    create an empty files
list --apps -i                  get a list of all installed apps
list --apps -a                  get a list of all running apps
sysmetric                       show session uptime, app usage, and process counts
sysrestart [0|1]                restart the OS (0=don't reopen apps, 1=reopen; default 0)
syssdwn [0|1]                   shut down the OS (0=don't reopen apps, 1=reopen; default 0)
sysreset                        shut down, clear localStorage and restore all defaults

All commands:
    cat, clear, close, curl, cd, download, date, ls, list, help, hostname, open, pwd, sysmetric, sysreset, sysrestart, syssdwn, touch, version, weather
    whoami
        `;
            return verbose;
        }

        return `unkown command:${arg2}`;
    }

    clear(arg:TerminalCommand[]):void{
        arg = [];
    }

    date():string{
        return new Date().toLocaleDateString();
    }

    // download(uri: string, fileName:string):void {

    //     if(!uri || uri === '.')
    //         uri = 'https://assets.mixkit.co/active_storage/video_items/100545/1725385175/100545-video-720.mp4';

    //     const contentType = 'application/octet-stream';
    //     const link  = document.createElement('a');
    //     const blob = new Blob([uri], {'type':contentType});
    //     console.log('blob data:', blob)
    //     link.href = window.URL.createObjectURL(blob);
    //     link.download = fileName;
    //     link.click();
    // }

    /**
     * Download a remote resource and write it into the virtual file system.
     *
     * Usage (positional args, each prefixed):
     *   src:<url>            required, http(s) URL
     *   dpath:<path>         optional, target directory (defaults to /Users/Downloads or `.` for cwd)
     *   filename:<name>      optional, safe filename (alphanumeric + underscore)
     *
     * Notes:
     *   - Names are validated against [A-Za-z0-9_]+ to prevent path traversal.
     *   - The remote body is read fully into memory via arrayBuffer(); callers
     *     should keep this in mind for very large downloads.
     */
    async download(srcUri: string, dest: string, name: string, commandID?:number): Promise<GenericResult> {
        const defaultDownloadLocation = Constants.DOWNLOADS_PATH;
        // Safe-filename regex: letters, digits, underscore. Used to block path traversal
        // and shell metacharacters in user-supplied filenames.
        const safeNameRegex = /^[a-zA-Z0-9_]+$/;
        const filePathRegex = /^(\.\.\/)+([a-zA-Z0-9_-]+\/?)*$|^(\.\/|\/)([a-zA-Z0-9_-]+\/?)+$|^\.\.$|^\.\.\/$/;

        if(!srcUri) {
            const response = `
download src must be specified.

Usage:
src:<uri>  dpath:<path>(Optional: default location is downloads folder) filename:<name>(Optional)
`;
            return {response:response, result:true};
        }

        // Strip the "src:" prefix before any further processing.
        const alteredSrcUri = srcUri.replace('src:', Constants.EMPTY_STRING).trim();

        // Only allow http(s) — refuse file://, data:, javascript:, etc.
        if (!alteredSrcUri.startsWith('http://') && !alteredSrcUri.startsWith('https://')) {
            return {response:'provide a valid url starting with http:// or https://', result:true};
        }

        // Derive a default filename from the *cleaned* URL (was previously using
        // the raw srcUri which could leak the "src:" prefix into the filename).
        const urlParts = alteredSrcUri.split(Constants.ROOT);
        const defaultFileName = urlParts[urlParts.length - 1] || 'download.bin';

        // ----- Resolve destination directory -----
        if(!dest){
            dest = defaultDownloadLocation;
        } else {
            const dlDest = dest.replace('dpath:', Constants.EMPTY_STRING);
            if(dlDest === '.'){ dest = this.currentDirectoryPath; }

            if(filePathRegex.test(dlDest)){
                const result = await this._fileService.exists(dlDest);
                if(!result){
                    return {response:'download folder does not exist', result:true};
                }
                dest = dlDest;
            }
        }

        // ----- Resolve filename -----
        // Previously this branch read `dest.replace('filename:', '')` (wrong source)
        // and validated the regex against the raw `name` (still prefixed). Fixed both.
        if(!name){
            name = defaultFileName;
        } else {
            const dlName = name.replace('filename:', Constants.EMPTY_STRING);
            if(dlName){
                if(!safeNameRegex.test(dlName)){
                    return {response: 'file name not allowed', result:true};
                }
                name = dlName;
            }
        }

        try {
            const response = await fetch(alteredSrcUri);
            // Handle non-OK responses (e.g., 404, 500)
            if (!response.ok) {
                return {response:`Download failed, status ${response.status} - ${response.statusText}`, result:false};
            }

            // Stream the body so we can report incremental progress back to the
            // terminal instead of blocking on response.arrayBuffer(). Falls back
            // to a single buffer read when the body stream isn't available.
            const reader = response.body?.getReader();
            let buffer:ArrayBuffer;

            if(reader){
                const contentLength = Number(response.headers.get('Content-Length')) || 0;
                const chunks:Uint8Array[] = [];
                let received = 0;

                // eslint-disable-next-line no-constant-condition
                while(true){
                    const {done, value} = await reader.read();
                    if(done) break;
                    if(value){
                        chunks.push(value);
                        received += value.length;

                        if(commandID !== undefined){
                            const progress = contentLength
                                ? `Downloading ${name}... ${Math.floor((received/contentLength)*100)}% (${this.formatBytes(received)}/${this.formatBytes(contentLength)})`
                                : `Downloading ${name}... ${this.formatBytes(received)}`;
                            this.emitLiveOutput(commandID, progress);
                        }
                    }
                }

                const merged = new Uint8Array(received);
                let offset = 0;
                for(const chunk of chunks){ merged.set(chunk, offset); offset += chunk.length; }
                buffer = merged.buffer;
            } else {
                buffer = await response.arrayBuffer();
            }

            if(buffer){
                const dlCntnt:FileInfo = new FileInfo();
                dlCntnt.setFileName = name;
                dlCntnt.setCurrentPath = `${dest}/${name}`;
                dlCntnt.setStringBuffer = Constants.EMPTY_STRING;
                // Previously commented out — meant downloaded files were written empty.
                // setContentBuffer accepts ArrayBuffer, which is exactly what fetch returns.
                dlCntnt.setContentBuffer = buffer;

                await this._fileService.writeFileAsync(dest, dlCntnt);
            }
        } catch (error:any) {
            return {response:`Error downloading file: ${error.message}`, result:false};
        }

        return {response:`Download successful,
    location:${dest}`, result:true};
    }

    

    hostname():string{
        const hostname = window.location.hostname;
        return hostname;
    }

    async weather(arg0:string):Promise<string>{
        const city = arg0;

        if (city == undefined || city == Constants.EMPTY_STRING || city.length == 0) {
          return 'Usage: weather [city]. Example: weather Indianapolis';
        }
    
        const weather = await fetch(`https://wttr.in/${city}?ATm`);
    
        return weather.text();
    }

    whoami():string{
        return this._defaultService.getDefaultSetting(Constants.DEFAULT_WHO_IS_THIS) ?? Constants.UNKNOWN;
    }

    /**
     * Sets DEFAULT_RESTORE_USER_OPENED_APPS from a "0|1" CLI flag:
     *   1 -> reopen currently running apps after login (TRUE)
     *   0 (or anything else / omitted) -> do not reopen (FALSE)
     * Returns the resolved flag so callers can echo the choice.
     */
    private applyReopenAppsFlag(arg:string):boolean{
        const reopen = (arg === '1');
        const value = reopen ? Constants.TRUE : Constants.FALSE;
        this._defaultService.updateDefaultData(Constants.DEFAULT_RESTORE_USER_OPENED_APPS, value, false);
        return reopen;
    }

    /** Restart the system. Optional 0|1 controls re-opening apps after login. */
    async sysrestart(arg?:string):Promise<string>{
        const eventDelay = 200; //200ms
        const reopen = this.applyReopenAppsFlag(arg ?? '0');

        CommonFunctions.prepareSystemForShutdownOrRestart(Constants.SYSTEM_RESTART, this._systemNotificationService,
            this._runningProcessService, this._processHandlerService, this._windowService, this._defaultService);

        await CommonFunctions.sleep(eventDelay);
        this._systemNotificationService.restartSystemNotify.next(Constants.RSTRT_ORDER_LOCK_SCREEN);
        return `Restarting...apps will ${reopen ? Constants.EMPTY_STRING : 'not '}be re-opened after login.`;
    }

    /** Shut the system down. Optional 0|1 controls re-opening apps after next login. */
    async syssdwn(arg?:string):Promise<string>{
        const reopen = this.applyReopenAppsFlag(arg ?? '0');

        CommonFunctions.prepareSystemForShutdownOrRestart(Constants.SYSTEM_SHUT_DOWN, this._systemNotificationService,
            this._runningProcessService, this._processHandlerService, this._windowService, this._defaultService);

        this._systemNotificationService.shutDownSystemNotify.next();
        return `Shutting down...apps will ${reopen ? Constants.EMPTY_STRING : 'not '}be re-opened after login.`;
    }

    /** Shut down, then wipe localStorage and restore all settings to factory defaults. */
    async sysreset():Promise<string>{
        // Do not re-open apps after a reset.
        this.applyReopenAppsFlag('0');

        CommonFunctions.prepareSystemForShutdownOrRestart(Constants.SYSTEM_SHUT_DOWN, this._systemNotificationService,
            this._runningProcessService, this._processHandlerService, this._windowService, this._defaultService);

        // Wipe all persisted state, then re-seed factory defaults.
        this._sessionManagementService.clearSession();
        this._defaultService.reset();

        this._systemNotificationService.shutDownSystemNotify.next();
        return 'System reset: localStorage cleared and defaults restored. Shutting down...';
    }

    sysmetric():string{
        const snapshot = this._systemMetric.getSnapshot();

        const sessionStart = new Date(snapshot.sessionStartTS).toLocaleString();
        const result:string[] = [];
        result.push('System Metrics');
        result.push('--------------');
        result.push(`Session started   : ${sessionStart}`);
        result.push(`Uptime            : ${this.formatDuration(snapshot.uptimeMs)}`);
        result.push(`Running processes : ${snapshot.runningProcessCount}`);
        result.push(`Running services  : ${snapshot.runningServiceCount}`);
        result.push(Constants.EMPTY_STRING);
        result.push('System Information');
        result.push('------------------');
        result.push(`Host OS           : ${CommonFunctions.getOS()}`);
        result.push(`Host Browser      : ${CommonFunctions.getBrowser()}`);
        result.push(Constants.EMPTY_STRING);
        result.push('App Usage');
        result.push('---------');

        if(snapshot.appUsage.length === 0){
            result.push('No app usage recorded this session.');
        }else{
            const sorted = [...snapshot.appUsage].sort((a, b) => b.launchCount - a.launchCount);
            for(const usage of sorted){
                const lastLaunch = new Date(usage.lastLaunchTS).toLocaleString();
                result.push(`${usage.name} - launches: ${usage.launchCount}, active: ${this.formatDuration(usage.totalActiveMs)}, last: ${lastLaunch}`);
            }
        }

        return result.join('\n');
    }

    private formatDuration(ms:number):string{
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    version(arg:string):string{

        const banner =  `
███████ ██ ███    ███ ██████  ██      ███████     ████████ ███████ ██████  ███    ███ ██ ███    ██  █████  ██      
██      ██ ████  ████ ██   ██ ██      ██             ██    ██      ██   ██ ████  ████ ██ ████   ██ ██   ██ ██      
███████ ██ ██ ████ ██ ██████  ██      █████          ██    █████   ██████  ██ ████ ██ ██ ██ ██  ██ ███████ ██      
     ██ ██ ██  ██  ██ ██      ██      ██             ██    ██      ██   ██ ██  ██  ██ ██ ██  ██ ██ ██   ██ ██      
███████ ██ ██      ██ ██      ███████ ███████        ██    ███████ ██   ██ ██      ██ ██ ██   ████ ██   ██ ███████

                                                                                            [Version ${arg}] \u00A9 ${new Date().getFullYear()}                                                                                                                              
        `

        return banner;
    }

    list(arg1:string, arg2:string):string{
        // Both args are required: `list --apps -i` (installed) or `list --apps -a` (active).
        if((arg1 == undefined || arg2 == undefined) || (arg1.length == 0 || arg2.length == 0))
            return 'incomplete command, list --apps -i  or list --apps -a';

        if(arg1 !== "--apps")
            return `unknown command: ${arg1}`;

        if(arg2 == "-i"){ // list installed apps
            return `Installed Apps: ${this._appDirctory.getAppList().join(', ')}`;
        }

        if(arg2 == "-a"){ // list running apps
            const runningProccess = this._runningProcessService.getProcesses();
            const result:string[] = [];

            // NOTE: the leading/trailing whitespace inside these template literals
            // is significant — it aligns the fixed-width ASCII table. Don't reflow.
            const tmpHead = `
+-----------------------+-----------------------+-----------------------+
|      Process Name     |      Process Type     |      Process ID       |
+-----------------------+-----------------------+-----------------------+
            `
            const tmpBottom = `
+-----------------------+-----------------------+-----------------------+`

            result.push(tmpHead);
            for(const process of runningProccess){
                const tmpMid = `
| ${this.addspaces(process.getProcessName)} | ${this.addspaces(process.getType)} | ${this.addspaces(process.getProcessId.toString())} |
            `
                result.push(tmpMid);
            }
            result.push(tmpBottom);

            return result.join(Constants.EMPTY_STRING); // Join with empty string to avoid commas
        }

        return `unknown option: ${arg2}. Usage: list --apps -i  or list --apps -a`;
    }

    open(arg0:string, arg1:string):string{

        if((arg0 == undefined || arg0.length == 0))
            return 'incomplete command, open --app <foo>';

        if(arg0 !== "--app")
            return `unkown command: ${arg0}`;

        if(arg1 == undefined || arg1.length == 0)
            return `incomplete command: open --app <foo>, <foo> must be provided`;

        if(this._appDirctory.appExist(arg1)){
            const file = new FileInfo()
            file.setOpensWith = arg1;

            if(this._processHandlerService){
                this._processHandlerService.runApplication(file);
            }
            return `opening app ${arg1}`;
        }else{
            return `${arg1}: No matching application found.`
        }
    }

    close(arg0:string, arg1:string):string{

        if((arg0 == undefined || arg0.length == 0))
            return 'incomplete command, close --app <pid>';

        if(arg0 !== "--app")
            return `unkown command: ${arg0}`;

        if(arg1 == undefined || arg1.length == 0)
            return `incomplete command: close --app <pid>, <pid> must be provided`;


        const pId = Number(arg1);
        const processToClose = this._runningProcessService.getProcess(pId);
        if(processToClose){
            if(this.closingNotAllowed.includes(processToClose.getProcessName)){
                return `The app: ${processToClose.getProcessName} is not allowed to be closed`;
            }else{
                this._runningProcessService.closeProcessNotify.next(processToClose);
                return `closing app, app name: ${processToClose.getProcessName}  app id: ${processToClose.getProcessId}`;
            }

        }else{
            return `${arg1}: No active process with pId:${arg1} found.`
        }
    }

    exit(arg0:number):void{
        const pId = arg0
        const processToClose = this._runningProcessService.getProcess(pId);
        if(processToClose)
            this._runningProcessService.closeProcessNotify.next(processToClose);
    }

    /**
     *
     *await curl(['curl', 'example.com']); // Simple GET request  
     *await curl(['curl', 'example.com', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', '{"name": "John"}']); // POST request with JSON  
     * @param args 
     * @returns 
     */
    async curl(args: string[]): Promise<string> {
        if (args.length < 2 || !args[1]) {
            return `
curl: no URL provided

Usage:
curl(['curl', 'example.com']); // Simple GET request  
curl(['curl', 'example.com', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', '{"name": "John"}']); // POST
            `;
        }
    
        let url = args[1];
    
        // Ensure the URL has a valid scheme
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }
    
        // Default options
        let method = 'GET';
        const headers: Record<string, string> = {};
        let body: string | undefined = undefined;
    
        // Parse additional arguments (e.g., -X POST, -H "Header: value", -d "body")
        for (let i = 2; i < args.length; i++) {
            switch (args[i]) {
                case '-X': // HTTP method
                    method = args[i + 1] || 'GET';
                    i++;
                    break;
                case '-H': // Headers
                    if (args[i + 1]) {
                        const headerParts = args[i + 1].split(':');
                        if (headerParts.length === 2) {
                            headers[headerParts[0].trim()] = headerParts[1].trim();
                        }
                        i++;
                    }
                    break;
                case '-d': // Request body (for POST/PUT)
                    body = args[i + 1] || Constants.EMPTY_STRING;
                    i++;
                    break;
            }
        }
    
        try {
            const response = await fetch(url, {
                method,
                headers,
                body: method !== 'GET' && method !== 'HEAD' ? body : undefined, // Only include body for relevant methods
            });
    
            const responseBody = await response.text();
    
            if (!response.ok) {
                return `curl: request failed with status ${response.status} - ${response.statusText}\n${responseBody}`;
            }
    
            return responseBody;
        } catch (error) {
            return `curl: could not fetch URL ${url}. Details: ${error}`;
        }
    }
    
    addspaces(arg:string, maxSpace = 21):string{
        const maxSpaceInput = maxSpace;
        const argLen = arg.length;
        const diff = maxSpaceInput - argLen;
        const strArr = arg.split("");
        let counter = 0;

        while(counter < diff){
            strArr.push(" ");
            //strArr.unshift(" ");
            counter++;
        }
        return strArr.join("");
    }

    pwd():string{
        return this.currentDirectoryPath;
    }

    genPermissionsRepresentation():void{
        const rwx:OctalRepresentation ={symbolic:'rwx', binary:111, permission:'Read + Write + Execute'};
        const rw_:OctalRepresentation ={symbolic:'rw-', binary:110, permission:'Read + Write'};
        const r_w:OctalRepresentation ={symbolic:'r-x', binary:101, permission:'Read + Execute'};
        const r__:OctalRepresentation ={symbolic:'r--', binary:100, permission:'Read'};
        const _wx:OctalRepresentation ={symbolic:'-wx', binary:0b11, permission:'Write + Execute'};
        const _w_:OctalRepresentation ={symbolic:'-w-', binary:0b10, permission:'Write'};
        const __x:OctalRepresentation ={symbolic:'--x', binary:0b01, permission:'Execute'};
        const ___:OctalRepresentation ={symbolic:'---', binary:0b00, permission:'None'};

        this.permissionChart.set(7, rwx);
        this.permissionChart.set(6, rw_);
        this.permissionChart.set(5, r_w);
        this.permissionChart.set(4, r__);
        this.permissionChart.set(3, _wx);
        this.permissionChart.set(2, _w_);
        this.permissionChart.set(1, __x);
        this.permissionChart.set(0, ___);
    }

    getPermission(arg0:string):string{
        let result = Constants.EMPTY_STRING;
        const argSplit = arg0.split(Constants.EMPTY_STRING);
        argSplit.shift();

        argSplit.forEach(x => {
            const permission = this.permissionChart.get(Number(x));
            result += permission?.symbolic;
        });

        return result;
    }

    async ls(path:string):Promise<LSResult>{
        let resultSet:LSResult;

        const TIME = 't', LIST = 'l', REVERSE = 'r';

        const result = await this.loadFilesInfoAsync(this.currentDirectoryPath).then(()=>{

            //hide the recylce bin
            if(this.currentDirectoryPath.includes(Constants.DESKTOP_PATH)){
                this.files = this.files.filter(x => x.getFileName !== Constants.RECYCLE_BIN);
            }

            if(path == undefined || path == Constants.EMPTY_STRING){
                const onlyFileNames:string[] = [];
                this.files.forEach(file => {
                    onlyFileNames.push(file.getFileName);
                });

                resultSet = {type:'string[]', result:onlyFileNames};
                return resultSet;
            }

            const lsOptions:string[] = ['-l', '-r', '-t', '-lr', '-rl', '-lt', '-tl', '-lrt', '-ltr', '-rtl', '-rlt', '-tlr', '-trl'];
            if(lsOptions.includes(path)) {
                
                const splitOptions = path.replace(Constants.DASH, Constants.EMPTY_STRING)
                    .split(Constants.EMPTY_STRING).sort().reverse();

                console.log('splitOptions:', splitOptions);
                const result:string[] = [];

                splitOptions.forEach(i => {
                    // sort by time
                    if( i === TIME){
                       this.files = this.files.sort((objA, objB) => objB.getDateModified.getTime() -  objA.getDateModified.getTime());
                    }else if( i  === REVERSE){ // reverse the order
                        this.files.reverse();
                    }else{ // present in list format
                        this.files.forEach(file => {
                            const strPermission =this.getPermission(file.getMode);
                            const fileNameWithExt = `${this.addBackTickToFileName(file.getFileName)}${file.getFileExtension}`;
                            const fileInfo = `
${(file.getIsFile)? '-':'d'}${this.addspaces(strPermission,10)} ${this.addspaces('Terminal',8)} ${this.addspaces('staff', 6)} ${this.addspaces(String(file.getSizeInBytes),6)}  ${this.addspaces(file.getDateTimeModifiedUS,12)} ${this.addspaces(fileNameWithExt,11)}
                        `
                            result.push(fileInfo);
                        });
                    }
                });
                resultSet = {type:'string', result:result.join(Constants.EMPTY_STRING)}; // Join with empty string to avoid commas
                return resultSet;
            }
            resultSet =  {type:Constants.EMPTY_STRING, result:Constants.EMPTY_STRING};
            return resultSet;
        })
        return result;
    }

    async cd(path:string):Promise<GenericResult>{
        const goOneLevelUpWithSlash = '../';

        let fixedPath = Constants.EMPTY_STRING;
        let result:GenericResult;

        if(path.includes(goOneLevelUpWithSlash)){
            const goOneLevelUp = '..';
            const moveUps = path.split(Constants.ROOT);
            const fMoveUps = moveUps.filter(x => x === goOneLevelUp);
            const impliedPath = this.getImpliedPath(fMoveUps);
            fixedPath = `${impliedPath}/${path}`.replaceAll(goOneLevelUpWithSlash, Constants.EMPTY_STRING);
        }else if(path.trim() === Constants.ROOT){
            fixedPath = Constants.ROOT;
        }else{
            // Collapse every run of consecutive slashes to a single one. A plain
            // string .replace() only fixes the FIRST match, so joins like
            // `/` + `/` + `/Users/...` (=> `///Users/...`) were left as `//Users/...`.
            fixedPath =  CommonFunctions.removeDoubleSlashes(`${this.currentDirectoryPath}/${path}`);
        }
        const res = await this._fileService.exists(fixedPath);
        if(res){
            this.currentDirectoryPath = fixedPath;
            result = {response:fixedPath, result:res};
            return result;
        }

        result = {response:'No such file or directory', result:false};
        return result;
    }

    addBackTickToFileName(fileName:string):string{
        const strArr = fileName.split(Constants.BLANK_SPACE);
        if(strArr.length > 1)
            return fileName.replaceAll(Constants.BLANK_SPACE, Constants.BACK_TICK);

        return fileName;
    }

    async traverseDirectory(pathInput:string):Promise<ITraverseResult>{
        console.log('ARG0:', pathInput);
        const users = '/Users/';
        const folder = Constants.FOLDER;
        const goOneLevelUp = '..';
        const goOneLevelUpWithSlash = '../';
        const filePathRegex = /^(\.\.\/)+([a-zA-Z0-9_-]+\/?)*$|^(\.\/|\/)([a-zA-Z0-9_-]+\/?)+$|^\.\.$|^\.\.\/$/;
        const path = pathInput.replace(Constants.BACK_TICK, Constants.BLANK_SPACE);

        let directory = Constants.EMPTY_STRING;
        let depth = 0;
        let result:ITraverseResult;

        if(!path){
            result = {type:Constants.EMPTY_STRING, result:Constants.EMPTY_STRING, depth:depth};
            return result;
        }

        if(filePathRegex.test(path)){
           const cmdArg = path.split(Constants.ROOT);
      
           console.log('CMDARG:', cmdArg);
           const moveUps = (cmdArg.length > 1)? cmdArg.filter(x => x === goOneLevelUp) : [goOneLevelUp];
           const impliedPath = this.getImpliedPath(moveUps);
           this.fallBackDirPath = impliedPath;
           const explicitPath = (path !== goOneLevelUp)? path.split(goOneLevelUpWithSlash).splice(-1)[0] : Constants.EMPTY_STRING;

           // Collapse any run of consecutive slashes to a single one (a plain
           // string .replace() only fixes the FIRST '//').
           directory = CommonFunctions.removeDoubleSlashes(`${impliedPath}/${explicitPath}`);
           this.fallBackDirPath = this.getFallBackPath(directory); // why didn't i add this before?

        //    console.log('IMPLIEDPATH:', impliedPath);
        //    console.log('EXPLICITPATH:', explicitPath);
        //    console.log('DIRECTORY:', directory);
        }else{
            directory = CommonFunctions.removeDoubleSlashes(`${this.currentDirectoryPath}/${path}`);
            this.fallBackDirPath = this.getFallBackPath(directory);
        }

        // console.log('directory:', directory);
        // console.log('fallBackDirPath:', this.fallBackDirPath);

        const firstDirectoryCheck = await this._fileService.exists(directory);
        let secondDirectoryCheck = false;

        if(!firstDirectoryCheck){
            secondDirectoryCheck = await this._fileService.exists(this.fallBackDirPath);

            if(secondDirectoryCheck){
                directory = this.fallBackDirPath;
            }
        }

        if(firstDirectoryCheck || secondDirectoryCheck){
            depth = this.getFolderDepth(directory);
            await this.loadFilesInfoAsync(directory);

            const files:string[] = [];
            this.files.forEach(file => {
                if(file.getFileType === folder && this.falseDirectories.includes(file.getFileName) 
                    && (this.fallBackDirPath.includes(users) || directory.includes(users))){

                    files.push(`${this.addBackTickToFileName(file.getFileName)}/`);
                } else if(file.getFileType === folder && !this.falseDirectories.includes(file.getFileName)){
                    files.push(`${this.addBackTickToFileName(file.getFileName)}/`);
                }else{
                    files.push(`${this.addBackTickToFileName(file.getFileName)}${file.getFileExtension}`);
                }
            });
            result = {type:'string[]', result:files, depth:depth};
            return result;

        }else{
            result = {type:'string', result:'No such file or directory', depth:depth};
            return result
        }
    }

    getImpliedPath(arg0:string[]):string{
        let directory = Constants.EMPTY_STRING;
        let dirPath = Constants.EMPTY_STRING;
        let cnt = 0;
        const tmpTraversedPath = this.currentDirectoryPath.split(Constants.ROOT);
        tmpTraversedPath.shift();
        const traversedPath = tmpTraversedPath.filter(x => x !== Constants.EMPTY_STRING);
        
        if(traversedPath.length === 0){
            return Constants.ROOT;
        } else if(traversedPath.length === 1){
            directory = traversedPath[0];
            return `/${directory}`;
        }else if(traversedPath.length > 1){
            // first, remove the current location, because it is where you currently are in the directory
            traversedPath.pop();
            cnt = traversedPath.length - 1;
            for(const el of arg0){
                if(cnt <= 0){
                    directory = traversedPath[0];
                    return `/${directory}`;
                }else{
                    const priorDirectory= traversedPath[cnt];
                    directory = priorDirectory;
                }
                cnt--;
            }

            const tmpStr:string[] = [];
            for(const el of traversedPath ){
                if(el !== directory){
                    tmpStr.push(`/${el}`);
                }else{
                    tmpStr.push(`/${directory}`);
                    break;
                }
            }
            dirPath = tmpStr.join(Constants.EMPTY_STRING);
        }

        return dirPath.replace(Constants.COMMA, Constants.EMPTY_STRING);
    }

    getFolderDepth(input: string): number {
        const matches = input.match(/\//g);
        return matches ? matches.length : 0;
    }

    getFallBackPath(arg0:string):string{
        /** given an input like this /osdrive/Documents/PD
         *create a function that splits directory and the assisgns a portion to fallback
         *this.fallBackDirPath = this.currentDirectoryPath;  /osdrive/Documents */

        const tmpTraversedPath = arg0.split(Constants.ROOT);
        const tmpStr:string[] = [];
        let dirPath = Constants.EMPTY_STRING;

        tmpTraversedPath.shift();
        const traversedPath = tmpTraversedPath.filter(x => x !== Constants.EMPTY_STRING);

        // first, remove the last entry in the array
        traversedPath.pop();

        traversedPath.forEach(el =>{
            tmpStr.push(`/${el}`);
        })
        tmpStr.push(Constants.ROOT);

        dirPath = tmpStr.join(Constants.EMPTY_STRING);
        return dirPath.replace(Constants.COMMA, Constants.EMPTY_STRING);
    }

    async touch(arg0: string):Promise<GenericResult>{
        const cmplxRegex = /^([\w\-.]+)\{(\d+)\.\.(\d+)\}$/;
        const cmplxRegexStr = /^([\w\-.]+)\{([a-zA-Z])\.\.([a-zA-Z])\}$/;
        const simpleRegex = /^[a-zA-Z0-9_]+$/;

        let fileName = Constants.EMPTY_STRING;
        let sub = Constants.EMPTY_STRING;
        let range:string[] = [];
  
        if(!arg0){
            const response = `
filename is required

Usage:
touch <filename>
touch <filename>{start_num..end_num};
touch <filename>{start_char..end_char}`;
            return {response:response, result:true};
        }

        if(arg0.match(cmplxRegex) || arg0.match(cmplxRegexStr)){
            fileName = arg0.substring(0, arg0.indexOf('{'));
            sub = arg0.substring(arg0.indexOf('{'), arg0.indexOf('}') + 1);
            range = sub.replace('{', Constants.EMPTY_STRING).replace('}', Constants.EMPTY_STRING).split('..');
        }

        if(arg0.match(cmplxRegex)){
            const start = Number(range[0]);
            const end =  Number(range[1]);

            for(let i = start; i <= end; i++){
                const newFile:FileInfo = new FileInfo();
                newFile.setFileName = `${fileName}_${i}.txt`;
                newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}_${i}.txt`;
                newFile.setContentPath = Constants.BLANK_SPACE;

                this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);
            }
            return {response:Constants.EMPTY_STRING, result:true};
        }else if(arg0.match(cmplxRegexStr)){
            const alphs:string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
                'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
            const start = alphs.indexOf(range[0]);
            const end =  alphs.indexOf(range[1]);

            for(let i = start; i <= end; i++){
                const newFile:FileInfo = new FileInfo();
                newFile.setFileName = `${fileName}_${alphs[i]}.txt`;
                newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}_${alphs[i]}.txt`;
                newFile.setContentPath = Constants.BLANK_SPACE;

                this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);
            }
            return {response:Constants.EMPTY_STRING, result:true};
        } else if(arg0.match(simpleRegex)){
            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = `${arg0}.txt`;
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${arg0}.txt`;
            newFile.setContentPath = Constants.BLANK_SPACE;

            this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }

        return {response:'Enter valid imput', result:true};
      }

    async cat(arg0: string):Promise<GenericResult>{
        //"cat file1.txt file2.txt > file3.txt"
        const concatRegex = /^cat (\S+(\s\S+)*) > (\S+)$/;

        //cat > file1.txt
        const createRegex = /^cat\s+>\s+[a-zA-Z0-9._-]+\.txt$/;

        //cat file.txt
        const readOrOpenRegex = /^cat\s+[a-zA-Z0-9._-]+\.txt$/;

        // "cat oldfile1.txt > newfileR.txt",
        const copyRegex = /^cat\s+[a-zA-Z0-9._-]+\.txt\s+>\s+[a-zA-Z0-9._-]+\.txt$/;

        //"cat 'Hello there, world' > newfile-1.txt",
        const writeCreateRegex = /^cat\s+'[^']*'\s+>\s+[a-zA-Z0-9._-]+\.txt$/;

        //"cat 'Hello there, world' > newfile-1.txt",
        const updateCreateRegex = /^cat\s+'[^']*'\s+>>\s+[a-zA-Z0-9._-]+\.txt$/;

        if(arg0.match(readOrOpenRegex)){
            const parts = arg0.split(Constants.BLANK_SPACE)
            const fileName = parts[1];

            const result = await this._fileService.exists(`${this.currentDirectoryPath}/${fileName}`);
            if(result){
                const textCntnt = await this._fileService.getFileAsTextAsync(`${this.currentDirectoryPath}/${fileName}`);

                return {response:textCntnt, result:true};
            }

            return {response:`file: ${fileName} not found`, result:true};

        }else if(arg0.match(createRegex)){
            // "cat > file.txt" — create an empty file.
            const parts = arg0.split(Constants.BLANK_SPACE);
            const fileName = parts[parts.length - 1];

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = fileName;
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}`;
            newFile.setStringBuffer = Constants.EMPTY_STRING;

            this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }else if(arg0.match(writeCreateRegex)){
            // Locate the two single-quote delimiters around the payload.
            const idxs:number[] = [];
            for(let i = 0; i <= arg0.length; i++){
                if(arg0[i] === "'")
                    idxs.push(i);
            }

            // Strip the surrounding quotes from the captured text. The previous
            // implementation used substring(idxs[0], idxs[1] + 1) which kept both
            // quote characters in the file's contents.
            const text = arg0.substring(idxs[0] + 1, idxs[1]);
            const parts = arg0.split(Constants.BLANK_SPACE);
            const fileName = parts[parts.length -1];

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = fileName,
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}`;
            newFile.setStringBuffer = text;

            this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }else if(arg0.match(updateCreateRegex)){
            // "cat 'text' >> file.txt" — append the quoted text to an existing
            // file (creating it when absent).
            const idxs:number[] = [];
            for(let i = 0; i <= arg0.length; i++){
                if(arg0[i] === "'")
                    idxs.push(i);
            }

            const text = arg0.substring(idxs[0] + 1, idxs[1]);
            const parts = arg0.split(Constants.BLANK_SPACE);
            const fileName = parts[parts.length - 1];

            let existingText = Constants.EMPTY_STRING;
            const exists = await this._fileService.exists(`${this.currentDirectoryPath}/${fileName}`);
            if(exists){
                existingText = await this._fileService.getFileAsTextAsync(`${this.currentDirectoryPath}/${fileName}`);
            }

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = fileName;
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}`;
            newFile.setStringBuffer = `${existingText}${text}`;

            this._fileService.updateFileAsync(newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }else if(arg0.match(copyRegex)){
            // "cat old.txt > new.txt" — copy the contents of one file into another.
            const parts = arg0.split(Constants.BLANK_SPACE);
            const srcFileName = parts[1];
            const destFileName = parts[parts.length - 1];

            const exists = await this._fileService.exists(`${this.currentDirectoryPath}/${srcFileName}`);
            if(!exists){
                return {response:`file: ${srcFileName} not found`, result:true};
            }

            const textCntnt = await this._fileService.getFileAsTextAsync(`${this.currentDirectoryPath}/${srcFileName}`);

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = destFileName;
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${destFileName}`;
            newFile.setStringBuffer = textCntnt;

            this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }else if(arg0.match(concatRegex)){
            // "cat f1.txt f2.txt f3.txt > f4.txt" — concatenate the sources, in
            // order, into the destination. Checked last because its pattern is
            // broad enough to also match the copy/write forms above.
            const parts = arg0.split(Constants.BLANK_SPACE);
            const redirectIdx = parts.indexOf('>');
            const srcFileNames = parts.slice(1, redirectIdx);
            const destFileName = parts[parts.length - 1];

            let combined = Constants.EMPTY_STRING;
            for(const srcFileName of srcFileNames){
                const exists = await this._fileService.exists(`${this.currentDirectoryPath}/${srcFileName}`);
                if(!exists){
                    return {response:`file: ${srcFileName} not found`, result:true};
                }
                combined += await this._fileService.getFileAsTextAsync(`${this.currentDirectoryPath}/${srcFileName}`);
            }

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = destFileName;
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${destFileName}`;
            newFile.setStringBuffer = combined;

            this._fileService.writeFileAsync(this.currentDirectoryPath, newFile);

            return {response:Constants.EMPTY_STRING, result:true};
        }

        const invalidResponse =`
Invalid cmd

Usage:
cat > file1.txt                                 Create file
cat 'This is a test of' > file1.txt             Create file with text
cat file1.txt                                   Read file
cat file1.txt file2.txt file3.txt > file4.txt   Concatenate file
cat oldfile.txt > newfile.txt                   Copy to new file
`;

       
        return {response:invalidResponse, result:true};
    }

    async mkdir(arg0:string, arg1:string):Promise<string>{
        
        const forbiddenChars:string[]= [ '\\', '/',':','*','?','"', '<', '>', '|', "'", '`'];

        if(arg0 && !forbiddenChars.includes(arg0)){
            const folderName = arg0;
            const  result = await this._fileService.createFolderAsync(this.currentDirectoryPath, folderName);//.then(()=>{ })
            if(result.ok){
                if(arg1 && arg1 == '-v'){
                    return `folder: ${arg0} successfully created`;
                }
                this.sendDirectoryUpdateNotification(this.currentDirectoryPath);
            }
        }else{
            return `
usage: mkdir direcotry_name [-v]
                        `;
        }

        return Constants.EMPTY_STRING;
    }

    async mv(sourceArg:string, destinationArg:string, thirdArg?:string, commandID?:number):Promise<string>{

        console.log(`sourceArg:${sourceArg}`);
        console.log(`destinationArg:${destinationArg}`);

        // mv has no general option parser; support a leading verbose flag only.
        // `mv -v <src> <dest>` shifts the args by one.
        let isVerbose = false;
        if(sourceArg === '-v' || sourceArg === '--verbose'){
            isVerbose = true;
            sourceArg = destinationArg;
            destinationArg = thirdArg as string;
        }

        if(sourceArg === undefined || sourceArg.length === 0)
            return 'source path required';

        if(destinationArg === undefined || destinationArg.length === 0)
            return 'destination path required';

        if(isVerbose && commandID !== undefined){
            //# pending deep granularity live output for recursive moves
        }

        if(commandID !== undefined)
            this.emitLiveOutput(commandID, `moving '${sourceArg}' -> '${destinationArg}'...`);

        const result =  await this._fileService.moveAsync(sourceArg, destinationArg);
        if(result){
            const result = await this.rm('-rf', sourceArg);
            if(result === Constants.EMPTY_STRING){
                if(destinationArg.includes(Constants.DESKTOP_PATH.substring(1))){
                    this.sendDirectoryUpdateNotification(sourceArg);
                    this.sendDirectoryUpdateNotification(destinationArg);
                }
                else
                    this.sendDirectoryUpdateNotification(sourceArg);

                if(isVerbose)
                    return `moved '${sourceArg}' -> '${destinationArg}'`;
            }
        }

        return Constants.EMPTY_STRING;
    }

    async cp(optionArg:any, sourceArg:string, destinationArg:string, commandID?:number):Promise<string>{

        console.log(`copy-source ${optionArg}`);
        console.log(`copy-destination ${sourceArg}`);
        //console.log(`destination ${destinationArg}`);

        if(destinationArg === undefined){
            destinationArg = sourceArg;

            if(destinationArg === Constants.DOT)
                destinationArg = this.currentDirectoryPath;
            
            sourceArg = optionArg.replaceAll(Constants.BACK_TICK, Constants.BLANK_SPACE);
            optionArg = undefined
        }

        if(destinationArg === Constants.DOT)
            destinationArg = this.currentDirectoryPath;
        
        
        const options = ['-f', '--force', '-R','-r','--recursive', '-v', '--verbose' , '--help'];
        let option = Constants.EMPTY_STRING;
        if(optionArg){
            option = (options.includes(optionArg as string))? optionArg : Constants.EMPTY_STRING;
            if(option === Constants.EMPTY_STRING)
                return `cp: invalid option ${optionArg as string}`

            if(option === '--help'){
                return `
Usage:
cp [option] [SOURCE] [DEST] copies SOURCE to DEST.

Mandatory argument to long options are mandotory for short options too.

-f, --force             copy file by force
-r, -R, -- recursive    copy folder recurively.
-v, --verbose           prints  files being copied
                `;
            }
        }

        if(sourceArg === undefined || sourceArg.length === 0)
            return 'source path required';

        if(destinationArg === undefined || destinationArg.length === 0)
            return 'destination path required';

        const stat = await this._fileService.getStatAsync(sourceArg);
        if(stat.isDirectory){
            if(option === Constants.EMPTY_STRING || option === '-f' || option === '--force' || option === '--verbose')
                return `cp: omitting directory ${sourceArg}`;

            if(option === '-r' || (option === '-R' || option === '--recursive')){

                const result = await this._fileService.copyAsync(sourceArg, destinationArg, !stat.isDirectory);
                if(result){
                    this.sendDirectoryUpdateNotification(destinationArg);
                }
            }
        }else{
            // just copy regular file
            //const result = await this.cp_file_handler(sourceArg,destinationArg);
            const isVerbose = option === '-v' || option === '--verbose';
            if(isVerbose && commandID !== undefined){
                //# pending deep granularity live output for recursive copies
            }

            if(commandID !== undefined)
                this.emitLiveOutput(commandID, `copying '${sourceArg}' -> '${destinationArg}'...`);

            const result = await this._fileService.copyAsync(sourceArg, destinationArg, stat.isDirectory);
            if(result){
                this.sendDirectoryUpdateNotification(destinationArg);
                if(isVerbose)
                    return `copied '${sourceArg}' -> '${destinationArg}'`;
            }
        }        
        return Constants.EMPTY_STRING;
    }

    async rm(optionArg:any, sourceArg:string, commandID?:number):Promise<string>{

        console.log(`source ${optionArg}`);
        console.log(`source ${sourceArg}`);


        const folderQueue:string[] = []
        if(sourceArg === undefined){
            sourceArg = optionArg;
            optionArg = undefined
        }

        
        const options = ['-rf', '-v', '--verbose'];
        let option = Constants.EMPTY_STRING;
        if(optionArg){
            option = (options.includes(optionArg as string))? optionArg : Constants.EMPTY_STRING;
            if(option === Constants.EMPTY_STRING)
                return `rm: invalid option ${optionArg as string}`

            if(option === '--help'){
                return `
Usage:
rm [options] [SOURCE] deletes SOURCE.

Mandatory argument to long options are mandotory for short options too.

-rf                 delete folder recurively.
-v, --verbose       prints  files being deleted.
                `;
            }
        }

        if(sourceArg === undefined || sourceArg.length === 0)
            return 'source path required';

        const stat = await this._fileService.getStatAsync(sourceArg);
        if(stat.isDirectory){
            if(option === Constants.EMPTY_STRING)
                return `rm: omitting directory ${sourceArg}`;

            if(option === '-rf'){
                folderQueue.push(sourceArg);
                const result = await this._fileService.deleteAsync(sourceArg, !stat.isDirectory);
                if(result){
                    this.sendDirectoryUpdateNotification(sourceArg);
                    return Constants.EMPTY_STRING;
                }
            }
        }else{
            // just delete regular file
            const isVerbose = option === '-v' || option === '--verbose';
            if(isVerbose && commandID !== undefined){
                //# pending deep granularity live output for recursive deletes
            }

            if(commandID !== undefined)
                this.emitLiveOutput(commandID, `removing '${sourceArg}'...`);

            const result = await this._fileService.deleteAsync(sourceArg, stat.isDirectory);
            if(result){
                this.sendDirectoryUpdateNotification(sourceArg);
                return isVerbose ? `removed '${sourceArg}'` : Constants.EMPTY_STRING;
            }
        }        
        return 'error';
    }

    private sendDirectoryUpdateNotification(arg0:string):void{
        if(arg0.includes(Constants.DESKTOP_PATH.substring(1))){
            this._fileService.addEventOriginator(Constants.DESKTOP);
        }else{
            this._fileService.addEventOriginator(Constants.FILE_EXPLORER);
        }
        this._fileService.dirFilesUpdateNotify.next();
    }

    private async loadFilesInfoAsync(directory:string):Promise<void>{
        this.files = [];
        //this._fileService.resetDirectoryFiles();
        const directoryEntries  = await this._fileService.loadDirectoryFiles(directory);
        this.files.push(...directoryEntries)
    
    }
}