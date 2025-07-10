import { Component, OnInit, AfterViewInit} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from "src/app/system-files/constants";
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/common.functions';
import { delay } from 'rxjs';

@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"]
})

export class CheetahComponent implements BaseComponent, OnInit, AfterViewInit{
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _audioService:AudioService;
  private _windowService:WindowService;


  infoMessageTimeOutId!:NodeJS.Timeout;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = Constants.NUM_ZERO;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'cheetah';
  version = 'Version: 3.07.04';
  year = `\u00A9 ${new Date().getFullYear()}`;
  infoMessage = Constants.EMPTY_STRING;

  readonly defaultAudio = `${Constants.AUDIO_BASE_PATH}about_cheetah.mp3`;

  constructor(processIdService:ProcessIDService,  runningProcessService:RunningProcessService, audioService:AudioService, windowService:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  async ngOnInit(): Promise<void> {
    await CommonFunctions.sleep((Constants.NUM_TEN * Constants.NUM_FIVE))
    await this._audioService.play(this.defaultAudio);
  }

   async ngAfterViewInit(): Promise<void> {
    await CommonFunctions.sleep((Constants.NUM_TEN))
    this.getInfoMessage();
  }

  getInfoMessage():void{
    this.infoMessage =`
CheetahOS
Version 3.07.04
Copyright\u00A9 Chinonso098 2022 - ${new Date().getFullYear()}

Windows 10 icons \u00A9 Microsoft Corporation. Windows (tm) is a 
registered trademark of Microsoft Corporation.
Other trademarks and logos are property of their respective owners
    `
  }

  onMouseEnter():void{
    //clear timeout just
    clearTimeout(this.infoMessageTimeOutId);

    const toolTipID = 'cheetahAboutTooltip';
    const aboutToolTip = document.getElementById(toolTipID) as HTMLElement;
    if(aboutToolTip){
      aboutToolTip.style.zIndex = '3';
      aboutToolTip.style.opacity = '1';
      aboutToolTip.style.transition = 'opacity 0.5s ease';
    }
  }

   onMouseLeave():void{
    const toolTipID = 'cheetahAboutTooltip';
    const aboutToolTip = document.getElementById(toolTipID) as HTMLElement;

    this.infoMessageTimeOutId = setTimeout(() => {
      if(aboutToolTip){
        aboutToolTip.style.zIndex = '-1';
        aboutToolTip.style.opacity = '0';
        aboutToolTip.style.transition = 'opacity 0.75s ease 1';
      }
    }, Constants.NUM_ONE_THOUSAND * Constants.NUM_FOUR); // wait 4 sec
  }

  setCheetahWindowToFocus(pid:number):void{
     this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}