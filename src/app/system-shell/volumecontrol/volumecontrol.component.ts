/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit } from '@angular/core';
import { Constants } from 'src/app/system-files/constants';
import { AudioService } from 'src/app/shared/system-service/audio.services';

@Component({
  selector: 'cos-volumecontrol',
  templateUrl: './volumecontrol.component.html',
  styleUrl: './volumecontrol.component.css',
  standalone:false,
})
export class VolumeControlComponent implements OnInit {

  // Icon shown next to the slider. Defaults to the muted icon until the
  // real volume is read from the audio service in ngOnInit.
  audioIcon = `${Constants.IMAGE_BASE_PATH}no_volume.png`;

  // The service volume expressed as a 0..1 fraction. -1 is reserved to
  // signal a genuine error reading the volume (renders the error icon).
  private currentVolume = -1;

  // The volume expressed as a whole-number percentage (0..100). Bound to
  // both the slider position and the numeric label in the template.
  adjustedVolume = 0;

  constructor(private _audioService: AudioService) { }

  ngOnInit(): void {
    // getVolume() returns the service-level volume synchronously, so we can
    // read it directly here without waiting for a track to be loaded.
    this.currentVolume = this._audioService.getVolume();
    this.setVolumeIcon();
  }

  setVolumeIcon():void{
    // A negative value means we could not read a real volume: show the error
    // icon and leave the percentage untouched.
    if(this.currentVolume === -1){
      this.audioIcon = `${Constants.IMAGE_BASE_PATH}volume_error.png`;
      return;
    }

    // Keep the displayed percentage in sync with the current volume. Rounding
    // avoids floating-point artefacts (e.g. 35.00000000000001) in the label.
    this.adjustedVolume = Math.round(this.currentVolume * 100);

    // Pick an icon using contiguous ranges so every possible volume (0..1)
    // maps to exactly one icon and never leaves a stale image on screen.
    if(this.currentVolume === 0){
      this.audioIcon = `${Constants.IMAGE_BASE_PATH}no_volume.png`;
    }else if(this.currentVolume <= 0.3){
      this.audioIcon = `${Constants.IMAGE_BASE_PATH}low_volume.png`;
    }else if(this.currentVolume <= 0.7){
      this.audioIcon = `${Constants.IMAGE_BASE_PATH}medium_volume.png`;
    }else{
      this.audioIcon = `${Constants.IMAGE_BASE_PATH}high_volume.png`;
    }
  }

  onVolumeSliderChange(event: Event):void{
    // The slider reports a whole-number percentage (0..100); convert it to the
    // 0..1 fraction the audio service expects.
    const inputElement = event.target as HTMLInputElement;
    const enteredValue = Number(inputElement.value);
    const newVolume = (enteredValue / 100);

    // Update local state, then refresh the icon and label from it.
    this.currentVolume = newVolume;
    this.setVolumeIcon();

    // Apply the new volume and notify any other listeners (e.g. the taskbar).
    this._audioService.changeVolume(newVolume);
    this._audioService.changeVolumeNotify.next();
  }

}
