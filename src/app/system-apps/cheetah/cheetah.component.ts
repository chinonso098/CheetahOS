import { Component, OnInit} from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from "src/app/system-files/constants";
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { WindowService } from 'src/app/shared/system-service/window.service';

@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"]
})

export class CheetahComponent implements BaseComponent, OnInit{
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;
  private _audioService:AudioService;
  private _windowService:WindowService;


  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  name = 'cheetah';
  version = 'Version: 3.06.08';
  year = `\u00A9 ${new Date().getFullYear()}`;

  readonly defaultAudio = `${Constants.AUDIO_BASE_PATH}about_cheetah.mp3`;

  constructor(processIdService:ProcessIDService,  runningProcessService:RunningProcessService, audioService:AudioService, windowService:WindowService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._windowService = windowService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    const secondsDelay = 50;

    setTimeout(() => {
      this._audioService.play(this.defaultAudio);
    }, secondsDelay);
  }

  setCheetahWindowToFocus(pid:number):void{
     this._windowService.focusOnCurrentProcessWindowNotify.next(pid);
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}