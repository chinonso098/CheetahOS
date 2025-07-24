import { Injectable } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { ProcessType } from "src/app/system-files/system.types";
import { ProcessIDService } from "./process.id.service";
import { RunningProcessService } from "./running.process.service";
import { Process } from "src/app/system-files/process";
import { Service } from "src/app/system-files/service";
import { BaseService } from "./base.service.interface";

interface Script {
    name: string;
    src: string;
  }
  
interface Scripts {
    [key: string]: Script;
  }
  
@Injectable({
    providedIn: 'root'
})

export class ScriptService implements BaseService {

  private _runningProcessService:RunningProcessService;
  private _processIdService:ProcessIDService;
  private scripts: Scripts = {};

  name = 'scripts_svc';
  icon = `${Constants.IMAGE_BASE_PATH}svc.png`;
  processId = 0;
  type = ProcessType.Cheetah;
  status  = Constants.SERVICES_STATE_RUNNING;
  hasWindow = false;
  description = 'handles loading of js scripts ';
    
  constructor(processIDService:ProcessIDService, runningProcessService:RunningProcessService){
      this._processIdService = processIDService;
      this._runningProcessService = runningProcessService;

      this.processId = this._processIdService.getNewProcessId();
      this._runningProcessService.addProcess(this.getProcessDetail());
      this._runningProcessService.addService(this.getServiceDetail());
  }

  async loadScript(name: string, src: string, isModule = true): Promise<void> {
    if (!this.scripts[name]) {
      this.scripts[name] = { name, src };
      return await this.loadExternalScript(this.scripts[name], isModule);
    }
    return Promise.resolve();
  }

  async loadScripts(names:string[], srcs: string[], isModule = true): Promise<void> {
    const promises: any[] = [];

    for(let i = 0; i <= names.length - 1 ; i++){
        if (!this.scripts[names[i]]) {
            this.scripts[names[i]] = { name:names[i], src:srcs[i] };
            const res =  await this.loadExternalScript(this.scripts[names[i]], isModule);
            promises.push(res) 
        }
    }
    
    return Promise.resolve();
  }

  private async loadExternalScript(script: Script, isModule:boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptElement = document.createElement('script');
      scriptElement.type = "text/javascript";
      scriptElement.src = script.src;

      if(isModule){
        scriptElement.type = 'module';
      }

      scriptElement.async = true;
      scriptElement.onload = () => {
        resolve();
      };
      scriptElement.onerror = (error: any) => {
        reject(error);
      };
      //document.body.appendChild(scriptElement);
      document.getElementsByTagName('head')[0].appendChild(scriptElement);
    });
  }

  private getProcessDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

  private getServiceDetail():Service{
    return new Service(this.processId, this.name, this.icon, this.type, this.description, this.status)
  }
}