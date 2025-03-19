import { AfterViewInit, Component } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from 'src/app/shared/system-service/audio.services';

@Component({
  selector: 'cos-volumecontrol',
  templateUrl: './volumecontrol.component.html',
  styleUrl: './volumecontrol.component.css'
})
export class VolumeControlComponent implements AfterViewInit {
  private _audioService!:AudioService

  audioIcon =`${Constants.IMAGE_BASE_PATH}no_volume.png`;
  private currentVolume = 0;
  adjustedVolume = 0;

  constructor(audioService:AudioService) { 
    this._audioService = audioService;
  }

  ngAfterViewInit():void{  
    setTimeout(() => {
      this.currentVolume = this._audioService.getVolume();
      this.setVolumeIcon();
    }, 0);
  }

  setVolumeIcon():void{
    if(this.currentVolume === 0){
      this.audioIcon =  `${Constants.IMAGE_BASE_PATH}no_volume.png`;
      this.adjustedVolume = 0;
    }else  if(this.currentVolume > 0 && this.currentVolume <= 0.3){
      this.audioIcon =  `${Constants.IMAGE_BASE_PATH}low_volume.png`;
      this.adjustedVolume = (this.currentVolume * 100);
    }else  if(this.currentVolume >= 0.4 && this.currentVolume <= 0.7){
      this.audioIcon =  `${Constants.IMAGE_BASE_PATH}medium_volume.png`;
      this.adjustedVolume = (this.currentVolume * 100);
    }else  if(this.currentVolume >= 0.8 && this.currentVolume <= 1){
      this.audioIcon =  `${Constants.IMAGE_BASE_PATH}high_volume.png`;
      this.adjustedVolume = (this.currentVolume * 100);
    }

  }

  onVolumeSliderChange(event: Event):void{
    const inputElement = event.target as HTMLInputElement;
    const enteredValue = Number(inputElement.value);
    this.adjustedVolume = enteredValue;
    const newVolume = enteredValue/100;

    this._audioService.changeVolume(newVolume);
    this._audioService.changeVolumeNotify.next();
  }

}
