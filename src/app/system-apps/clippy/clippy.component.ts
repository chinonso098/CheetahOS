import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-base/base/base.component';
import { ComponentType } from 'src/app/system-files/component.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';

@Component({
  selector: 'cos-clippy',
  standalone: true,
  imports: [],
  templateUrl: './clippy.component.html',
  styleUrl: './clippy.component.css'
})
export class ClippyComponent implements BaseComponent, OnInit, OnDestroy, AfterViewInit {

  @ViewChild('clippyToolTip', {static: true}) clippyToolTip!: ElementRef;
  @ViewChild('clippyToolTipText', {static: true}) clippyToolTipText!: ElementRef;
  @ViewChild('clippyGifFigure', {static: true}) clippyGifFigure!: ElementRef; 

  private _runningProcessService:RunningProcessService;

  gifPath = `${Constants.GIF_BASE_PATH}clippy_hey_you.gif`;
  SHOW_TOOL_TIP_DELAY = 500; 
  MAX_TOOL_TIP_DISPLAY_DURATION =4500; 
  MIN_GIF_DISPLAY_DURATION = 6000;
  PID = 20000;
  clippyDurations:number[] = [4400,2400,13600,7500,1800,5500,8400,4100,6600,2200,3500,2800,3000,3000,5000,4500,1900,2600,8100,4800];

  clippyAnimations:string[] = ['clippy_correct','clippy_listen_music','clippy_relax','clippy_melt','clippy_look_down','clippy_boxed',
    'clippy_silly','clippy_goodbye','clippy_reading','clippy_point_here','clippy_hi_there','clippy_point_up','clippy_point_right',
    'clippy_point_left','clippy_file_vortex', 'clippy_atomic','clippy_puzzled','clippy_hey_you','clippy_searching','clippy_no'];

  clippyTextTips:string[] = ['Do not interrupt me!!'];


  isToolTipVisible = false;
  toolTipText = 'This is a test of the emergency broadcast system';

  name= 'clippy';
  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  processId = 0;
  type = ComponentType.User;
  displayName = Constants.EMPTY_STRING;

  constructor(runningProcessService:RunningProcessService) {       
    this._runningProcessService = runningProcessService;
    this.processId = this.PID;
    this._runningProcessService.addProcess(this.getComponentDetail());
  }
  

  ngOnInit(): void {
   1
  }

  ngAfterViewInit():void{   
    this.showClippyToolTip();
  }

  ngOnDestroy():void{
    1
  }

  onToolTipCntnrClick():void{
    this.toolTipText = this.clippyTextTips[0];
    this.gifPath = `${Constants.GIF_BASE_PATH}clippy_no.gif`;
  }

  onClippyGifCntnrClick():void{
    this.toolTipText = this.clippyTextTips[0];
    this.gifPath = `${Constants.GIF_BASE_PATH}clippy_no.gif`;
  }

  private showClippyToolTip():void{

    setTimeout(()=>{
      this.clippyToolTip.nativeElement.style.visibility = 'visible';
      this.clippyToolTip.nativeElement.style.opacity = 1;
      this.clippyToolTip.nativeElement.style.transition = 'opacity 0.3s ease-in';

      this.clippyToolTipText.nativeElement.style.visibility = 'visible';
      this.clippyToolTipText.nativeElement.style.opacity = 1;
      this.clippyToolTipText.nativeElement.style.transition = 'opacity 0.3s ease-in';

    },this.SHOW_TOOL_TIP_DELAY) 
  }

  private hideClippyToolTip():void{
    this.clippyToolTip.nativeElement.style.visibility = 'hidden';
    this.clippyToolTip.nativeElement.style.opacity = 0;
    this.clippyToolTip.nativeElement.style.transition = 'opacity 0.3s ease-out';

    this.clippyToolTipText.nativeElement.style.visibility = 'hidden';
    this.clippyToolTipText.nativeElement.style.opacity = 0;
    this.clippyToolTipText.nativeElement.style.transition = 'opacity 0.3s ease-out';
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
