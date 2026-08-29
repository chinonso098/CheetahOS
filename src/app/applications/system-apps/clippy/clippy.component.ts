/* eslint-disable @angular-eslint/prefer-standalone */
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, OnChanges, ViewChild, ChangeDetectorRef, SimpleChanges  } from '@angular/core';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';
import { Process } from 'src/app/system-files/process';

@Component({
  selector: 'cos-clippy',
  templateUrl: './clippy.component.html',
  styleUrl: './clippy.component.css',
  standalone:false,
})

export class ClippyComponent implements BaseComponent, OnInit, OnDestroy, OnChanges, AfterViewInit {

  @ViewChild('clippyToolTip', {static: true}) clippyToolTip!: ElementRef;
  @ViewChild('clippyToolTipText', {static: true}) clippyToolTipText!: ElementRef;
  @ViewChild('clippyGifImg', {static: true}) clippyGifImg!: ElementRef; 

  private _runningProcessService!:RunningProcessService;
  private _changeDetectorRef: ChangeDetectorRef

  toolTipText = Constants.EMPTY_STRING;
  gifPath = Constants.EMPTY_STRING;
  randomSelection = -1;
  selectedDuration = -1;
  selectedAnimation = Constants.EMPTY_STRING;

  isToolTipVisible = false;

  private _showToolTipTimeoutId?: ReturnType<typeof setTimeout>;
  private _hideToolTipTimeoutId?: ReturnType<typeof setTimeout>;
  private _selfDestructTimeoutId?: ReturnType<typeof setTimeout>;
  private _selfDestructCleanupTimeoutId?: ReturnType<typeof setTimeout>;
  private _isDestroyed = false;

  clippyDurations:number[] = [4400,2400,13600,7500,1800,5500,8400,4100,6600,2200,3500,2800,3000,3000,5000,4500,1900,2600,8100,4800];

  clippyAnimations:string[] = ['clippy_correct','clippy_listen_music','clippy_relax','clippy_melt','clippy_look_down','clippy_boxed',
    'clippy_silly','clippy_goodbye','clippy_reading','clippy_point_here','clippy_hi_there','clippy_point_up','clippy_point_right',
    'clippy_point_left','clippy_file_vortex', 'clippy_atomic','clippy_puzzled','clippy_hey_you','clippy_searching','clippy_no'];

  clippyTextTips:string[] = ['Do not interrupt me!!','Some tasty grooves'];

  clippyTextQuotes:string[] = ['The grass is greener where you water it','Be the change that you wish to see in the world',
    'Genius is 1% inspiration, 99% perspiration', 'fortune favors the prepared', 'Sometimes you win, sometimes you learn', 
    'consistency trumps intensity', 'Alone, we can do so little; together we can do so much',
    'It wasn’t raining when Noah built the ark','The successful warrior is the average man, with laser-like focus',
    'Speak less than you know; have more than you show', 'Reading is to the mind, as exercise is to the body',
    'The man who has confidence in himself gains the confidence of others', 'Knowing is not enough; we must apply', 
    'This,too, shall pass', 'What we achieve inwardly will change outer reality','We can’t help everyone, but everyone can help someone'
  ];

  readonly name= 'clippy';
  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}generic_program.png`;
  readonly processId = 20000;
  type = ComponentType.User;
  displayName = Constants.EMPTY_STRING;

  constructor(runningProcessService:RunningProcessService, changeDetectorRef: ChangeDetectorRef) {       
    this._runningProcessService = runningProcessService;
    this._changeDetectorRef = changeDetectorRef;

    this._runningProcessService.addProcess(this.getComponentDetail());
  }
  
  ngOnInit(): void {
    //gen number between (0 - 19)
    this.randomSelection = this.randomIntFromInterval(0, 19);
    this.selectedDuration = this.clippyDurations[this.randomSelection];
    this.selectedAnimation = this.clippyAnimations[this.randomSelection];
    this.toolTipText = this.clippyTextQuotes[this.randomIntFromInterval(0, 15)];
  }

  ngOnChanges(changes: SimpleChanges):void{
    console.log('CLIPPY onCHANGES:',changes);
  }

  ngAfterViewInit():void{   
    this.gifPath = `${Constants.GIF_BASE_PATH}${this.selectedAnimation}.gif`;
    //tell angular to run additional detection cycle after 
    this._changeDetectorRef.detectChanges();
    this.showClippyToolTip();
    this.selfDestruct();
  }

  ngOnDestroy():void{
    this._isDestroyed = true;
    if(this._showToolTipTimeoutId) clearTimeout(this._showToolTipTimeoutId);
    if(this._hideToolTipTimeoutId) clearTimeout(this._hideToolTipTimeoutId);
    if(this._selfDestructTimeoutId) clearTimeout(this._selfDestructTimeoutId);
    if(this._selfDestructCleanupTimeoutId) clearTimeout(this._selfDestructCleanupTimeoutId);
  }

  randomIntFromInterval(min:number, max:number):number{ 
    // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
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
    const showToolTipDelay = 500;
    const minToolTipDisplayDuration = 4500;

    this._showToolTipTimeoutId = setTimeout(()=>{
      if(this._isDestroyed) return;
      this.clippyToolTip.nativeElement.style.visibility = 'visible';
      this.clippyToolTip.nativeElement.style.opacity = 1;
      this.clippyToolTip.nativeElement.style.transition = 'opacity 0.3s ease-in';

      this.clippyToolTipText.nativeElement.style.visibility = 'visible';
      this.clippyToolTipText.nativeElement.style.opacity = 1;
      this.clippyToolTipText.nativeElement.style.transition = 'opacity 0.3s ease-in';

      this._hideToolTipTimeoutId = setTimeout(()=>{
        if(this._isDestroyed) return;
        this.hideClippyToolTip();
      },minToolTipDisplayDuration) 

    },showToolTipDelay) 
  }

  private hideClippyToolTip():void{
    this.clippyToolTip.nativeElement.style.opacity = 0;
    this.clippyToolTip.nativeElement.style.transition = 'opacity 0.3s ease-out';
    this.clippyToolTip.nativeElement.style.visibility = 'hidden';

    this.clippyToolTipText.nativeElement.style.opacity = 0;
    this.clippyToolTipText.nativeElement.style.transition = 'opacity 0.3s ease-out';
    this.clippyToolTipText.nativeElement.style.visibility = 'hidden';
  }

  /** Animation duration for the close sequence (ms). Kept in sync with the
   *  cleanup delay so the process is only removed once the animation ends. */
  private readonly CLOSE_ANIMATION_DURATION = 900;

  private playCloseAnimation():void{
    const gif = this.clippyGifImg?.nativeElement as HTMLElement | undefined;
    const tip = this.clippyToolTip?.nativeElement as HTMLElement | undefined;
    const tipText = this.clippyToolTipText?.nativeElement as HTMLElement | undefined;
    const easing = 'cubic-bezier(0.4, 0.0, 0.2, 1)'; // standard material easing
    const duration = `${this.CLOSE_ANIMATION_DURATION}ms`;

    if(gif){
      // Promote to its own layer for smoother GPU-accelerated animation.
      gif.style.willChange = 'transform, opacity';
      gif.style.transformOrigin = 'center center';
      gif.style.transition = `transform ${duration} ${easing}, opacity ${duration} ${easing}`;
      // Spin + shrink + fade in one combined transform.
      gif.style.transform = 'rotate(360deg) scale(0.2)';
      gif.style.opacity = '0';
    }

    // Fade the tooltip out alongside the gif so the whole widget exits together.
    const tooltipFadeDuration = `${Math.round(this.CLOSE_ANIMATION_DURATION * 0.6)}ms`;
    if(tip){
      tip.style.willChange = 'opacity';
      tip.style.transition = `opacity ${tooltipFadeDuration} ease-out`;
      tip.style.opacity = '0';
    }
    if(tipText){
      tipText.style.willChange = 'opacity';
      tipText.style.transition = `opacity ${tooltipFadeDuration} ease-out`;
      tipText.style.opacity = '0';
    }
  }

  private selfDestruct():void{
    const minGIFDisplayDuration = 6000;
    while(this.selectedDuration < minGIFDisplayDuration){
      const durationRatio = (this.selectedDuration / minGIFDisplayDuration);      
      const remainingRatio = 1 - durationRatio;      
      const durationIncrease = (remainingRatio * minGIFDisplayDuration);
      this.selectedDuration += durationIncrease;
    }

    this._selfDestructTimeoutId = setTimeout(()=>{
      if(this._isDestroyed) return;
      this.playCloseAnimation();
      this._selfDestructCleanupTimeoutId = setTimeout(()=>{
        if(this._isDestroyed) return;
        const processToClose = this._runningProcessService.getProcess(this.processId);
        if(processToClose)
          this._runningProcessService.closeProcessNotify.next(processToClose);
        
      }, this.CLOSE_ANIMATION_DURATION) 
    },this.selectedDuration) 
  }
  
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
