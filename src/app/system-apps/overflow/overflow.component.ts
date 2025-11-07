/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { CommonFunctions } from 'src/app/system-files/common.functions';

@Component({
  selector: 'cos-overflow',
  templateUrl: './overflow.component.html',
  styleUrl: './overflow.component.css',
  standalone:false,
})
export class OverFlowComponent implements AfterViewInit {
  private _audioService!:AudioService

  audioIcon =`${Constants.IMAGE_BASE_PATH}no_volume.png`;
  taskManagerIcon =`${Constants.IMAGE_BASE_PATH}taskmanager_grid.png`

  tskMngrUtil = 0; // accepts a number between 0 and 100

  constructor(audioService:AudioService) { 
    this._audioService = audioService;
  }

  ngAfterViewInit():void{  
    const delay = 2000; //50ms    

    setInterval(() => {
      this.tskMngrUtil = this.getRandomInt(10, 100);
    }, delay);
  }

  getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
