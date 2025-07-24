import { GenericResult, ITraverseResult, LSResult, TerminalCommand } from "./model/terminal.types";
import { AppDirectory } from "src/app/system-files/app.directory";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { FileInfo } from "src/app/system-files/file.info";
import { RunningProcessService } from "src/app/shared/system-service/running.process.service";
//import {extname, basename, resolve, dirname} from 'path';
import { FileService } from "src/app/shared/system-service/file.service";
import { FileEntry } from 'src/app/system-files/file.entry';
import { Constants } from 'src/app/system-files/constants';
import { Buffer } from 'buffer';


export interface OctalRepresentation {
    symbolic:string;
    binary: number;
    permission: string;
}

export class TerminalCommandProcessor{

    private _processHandlerService:ProcessHandlerService;
    private _runningProcessService:RunningProcessService;
    private _fileService:FileService;
    private _directoryFilesEntries!:FileEntry[];
    private _appDirctory = new AppDirectory();
  
    
    private  permissionChart!:Map<number, OctalRepresentation>;
    private closingNotAllowed:string[] = ["system", "desktop", "filemanager", "taskbar", "startbutton", "clock", "taskbarentry", "startmenu","volume",
        "cmpnt_ref_svc", "file_mgr_svc", "file_svc", "menu_svc", "notification_svc", "pid_gen_svc", "rning_proc_svc", "scripts_svc",
        "session_mgmt_svc", "state_mgmt_svc","trgr_proc_svc", "window_mgmt_svc",  "audio_svc"];

    private falseDirectories:string[] = ["3D-Objects", "Desktop", "Documents", "Downloads", "Games", "Music", "Pictures", "Videos"];
        
    private files:FileInfo[] = [];
    private readonly defaultDirectoryPath = Constants.ROOT;
    private currentDirectoryPath = Constants.ROOT;
    private fallBackDirPath = Constants.EMPTY_STRING;

    constructor(controlProcessService:ProcessHandlerService, runningProcessService:RunningProcessService, fileService:FileService) { 
        this._processHandlerService = controlProcessService;
        this._runningProcessService = runningProcessService;
        this._fileService = fileService;
        this.permissionChart = new Map<number, OctalRepresentation>();
        this.genPermissionsRepresentation();
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
close --app <pid>               closes app <pid>
clear                           clears the terminal output and all previous command
curl                            query Api's
download <uri> <path> <name>    download from the internet by providing a urls
ls                              list files and folder in the present directory
cd                              change directory
cp  -<option> <path> <path>     copy from source to destination folder
mv  <path> <path>               move from source to destination folder
cat <file>                      open the contents 
tocuh <file>                    create an empty files
list --apps -i                  get a list of all installed apps
list --apps -a                  get a list of all running apps

All commands:
    cat, clear, close, curl, cd, download, date, ls, list, help, hostname, open, pwd, touch, version, weather
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

    async download(srcUri: string, dest: string, name: string): Promise<GenericResult> {     
        const defualtDownloadLocation = '/Users/Downloads';
        const regexStr = '^[a-zA-Z0-9_]+$';
        const res = new RegExp(regexStr).test(name);
        const filePathRegex = /^(\.\.\/)+([a-zA-Z0-9_-]+\/?)*$|^(\.\/|\/)([a-zA-Z0-9_-]+\/?)+$|^\.\.$|^\.\.\/$/;

        let defaultfileName = Constants.EMPTY_STRING;
        
        if(!srcUri) {
            const response = `
download src must be specified.

Usage:
src:<uri>  dpath:<path>(Optional: default location is downloads folder) filename:<name>(Optional)
`;
            return {response:response, result:true};
        }

        const alteredSrcUri = srcUri.replace('src:', Constants.EMPTY_STRING).trim();
        // Ensure the URL has a valid scheme
        if (!alteredSrcUri.startsWith('http://') && !alteredSrcUri.startsWith('https://')) {
            return {response:'provide a valid url starting with http:// or https://', result:true};
        }

        const parts = srcUri.split(Constants.ROOT)
        defaultfileName = parts[parts.length - 1];

        if(!dest){  dest = defualtDownloadLocation; }
        else{
            const dlDest = dest.replace('dpath:', Constants.EMPTY_STRING)
            if(dlDest === '.'){ dest = this.currentDirectoryPath; }

            if(filePathRegex.test(dlDest)){
               const result = await this._fileService.exists(dlDest);
               if(!result){
                return {response:'download folder does not exist', result:true};
               }

               dest = dlDest;
            }
        }

        if(!name){  name = defaultfileName;}
        else{
            const dlName = dest.replace('filename:', Constants.EMPTY_STRING)
            if(dlName){
                if(!res){
                    return {response: 'file name not allowed', result:true};
                }
                name = dlName;
            }
        }

        try {    
            const response = await fetch(alteredSrcUri);
            // Handle non-OK responses (e.g., 404, 500)
            if (!response.ok) {
                return {response:`Download failed, status ${response.status} - ${response.statusText}`, result:false}
            }
    
            const buffer = await response.arrayBuffer();
            if(buffer){
                const dlCntnt:FileInfo = new FileInfo();
                dlCntnt.setFileName = name,
                dlCntnt.setCurrentPath = `${dest}/${name}`;
                dlCntnt.setContentBuffer = Buffer.from(buffer);

                this._fileService.writeFileAsync(dest, dlCntnt);
            }    
        } catch (error:any) {
            return {response:`Error downloading file: ${error.message}`, result:false};
        }

        return {response:`Download successful, location:${dest}`, result:true};
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
        return 'guest';
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
        const runningProccess = this._runningProcessService.getProcesses();
        if((arg1 == undefined || arg2 == undefined) || (arg1.length == 0 || arg2.length == 0))
            return 'incomplete command, list --apps -i  or list --apps -a';

        if(arg1 !== "--apps")
            return `unkown command: ${arg1}`;

        if(arg2 == "-i"){ // list install apps
            return `Installed Apps: ${this._appDirctory.getAppList().join(', ')}`;
        }

        if(arg2 == "-a"){ // list install apps
            const result:string[] = [];
            const tmpHead = `
+-----------------------+-----------------------+-----------------------+
|      Process Name     |      Process Type     |      Process ID       |
+-----------------------+-----------------------+-----------------------+
            `
            result.push(tmpHead)
            const tmpBottom = `
+-----------------------+-----------------------+-----------------------+`
            for(let i = 0; i <= runningProccess.length - 1; i++){
                const process = runningProccess[i];
                const tmpMid = `
| ${this.addspaces(process.getProcessName)} | ${this.addspaces(process.getType)} | ${this.addspaces(process.getProcessId.toString())} |
            `
                result.push(tmpMid);
            }

            result.push(tmpBottom);
            return result.join(Constants.EMPTY_STRING); // Join with empty string to avoid commas
        }
        return Constants.EMPTY_STRING;
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
                this._processHandlerService.startApplicationProcess(file);
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


        const pid = Number(arg1);
        const processToClose = this._runningProcessService.getProcess(pid);
        if(processToClose){
            if(this.closingNotAllowed.includes(processToClose.getProcessName)){
                return `The app: ${processToClose.getProcessName} is not allowed to be closed`;
            }else{
                this._runningProcessService.closeProcessNotify.next(processToClose);
                return `closing app, app name: ${processToClose.getProcessName}  app id: ${processToClose.getProcessId}`;
            }

        }else{
            return `${arg1}: No active process with pid:${arg1} found.`
        }
    }

    exit(arg0:number):void{
        
        const pid = arg0
        const processToClose = this._runningProcessService.getProcess(pid);
        if(processToClose){
            this._runningProcessService.closeProcessNotify.next(processToClose);
        }
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
            fixedPath = `${this.currentDirectoryPath}/${path}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
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

        if(path === undefined){
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

           directory = `${impliedPath}/${explicitPath}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
           this.fallBackDirPath = this.getFallBackPath(directory); // why didn't i add this before?

           console.log('IMPLIEDPATH:', impliedPath);
           console.log('EXPLICITPATH:', explicitPath);
           console.log('DIRECTORY:', directory);
        }else{
            directory = `${this.currentDirectoryPath}/${path}`.replace(Constants.DOUBLE_SLASH, Constants.ROOT);
            this.fallBackDirPath = this.getFallBackPath(directory);
        }

        console.log('directory:', directory);
        console.log('fallBackDirPath:', this.fallBackDirPath);

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
            const fetchedFiles = await this.loadFilesInfoAsync(directory).then(()=>{
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
            })

            return fetchedFiles;
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
                //
        }else if(arg0.match(writeCreateRegex)){
            const idxs = [];
            for( let i = 0; i <= arg0.length; i++){
                if(arg0[i] === "'")
                    idxs.push(i)
            }

            const text = arg0.substring(idxs[0], idxs[1] + 1);
            const parts = arg0.split(Constants.BLANK_SPACE)
            const fileName = parts[parts.length -1];

            const newFile:FileInfo = new FileInfo();
            newFile.setFileName = fileName,
            newFile.setCurrentPath = `${this.currentDirectoryPath}/${fileName}`;
            newFile.setContentPath = text

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
            if(result){
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

    async mv(sourceArg:string, destinationArg:string):Promise<string>{

        console.log(`sourceArg:${sourceArg}`);
        console.log(`destinationArg:${destinationArg}`);

        if(sourceArg === undefined || sourceArg.length === 0)
            return 'source path required';

        if(destinationArg === undefined || destinationArg.length === 0)
            return 'destination path required';

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
            }
        }

        return Constants.EMPTY_STRING;
    }

    async cp(optionArg:any, sourceArg:string, destinationArg:string):Promise<string>{

        console.log(`copy-source ${optionArg}`);
        console.log(`copy-destination ${sourceArg}`);
        //console.log(`destination ${destinationArg}`);

        if(destinationArg === undefined){
            destinationArg = sourceArg;
            if(destinationArg === '.'){
                destinationArg = this.currentDirectoryPath;
            }
            sourceArg = optionArg.replaceAll(Constants.BACK_TICK, Constants.BLANK_SPACE);
            optionArg = undefined
        }
        if(destinationArg === '.'){
            destinationArg = this.currentDirectoryPath;
        }
        
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

        const isDirectory = await this._fileService.isDirectory(sourceArg);
        if(isDirectory){
            if(option === Constants.EMPTY_STRING || option === '-f' || option === '--force' || option === '--verbose')
                return `cp: omitting directory ${sourceArg}`;

            if(option === '-r' || (option === '-R' || option === '--recursive')){

                const result = await this._fileService.copyAsync(sourceArg, destinationArg, !isDirectory);
                if(result){
                    this.sendDirectoryUpdateNotification(destinationArg);
                }
            }
        }else{
            // just copy regular file
            //const result = await this.cp_file_handler(sourceArg,destinationArg);
            const result = await this._fileService.copyAsync(sourceArg, destinationArg, isDirectory);
            if(result){
                this.sendDirectoryUpdateNotification(destinationArg);
            }
        }        
        return Constants.EMPTY_STRING;
    }

    async rm(optionArg:any, sourceArg:string):Promise<string>{

        console.log(`source ${optionArg}`);
        console.log(`source ${sourceArg}`);


        const folderQueue:string[] = []
        if(sourceArg === undefined){
            sourceArg = optionArg;
            optionArg = undefined
        }

        
        const options = ['-rf'];
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

        const isDirectory = await this._fileService.isDirectory(sourceArg);
        if(isDirectory){
            if(option === Constants.EMPTY_STRING)
                return `rm: omitting directory ${sourceArg}`;

            if(option === '-rf'){
                folderQueue.push(sourceArg);
                const result = await this._fileService.deleteAsync(sourceArg, !isDirectory);
                if(result){
                    this.sendDirectoryUpdateNotification(sourceArg);
                    return Constants.EMPTY_STRING;
                }
            }
        }else{
            // just delete regular file
            const result = await this._fileService.deleteAsync(sourceArg, isDirectory);
            if(result){
                this.sendDirectoryUpdateNotification(sourceArg);
                return Constants.EMPTY_STRING;
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
        this._fileService.resetDirectoryFiles();
        const directoryEntries  = await this._fileService.loadDirectoryFiles(directory);
        this.files.push(...directoryEntries)
    
    }
}