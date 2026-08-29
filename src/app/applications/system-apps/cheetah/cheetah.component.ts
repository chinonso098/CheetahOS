/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, Renderer2, HostBinding } from '@angular/core';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from "src/app/system-files/constants";
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { Process } from 'src/app/system-files/process';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';
import { Subscription } from 'rxjs';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';


@Component({
  selector:'cos-cheetah',
  templateUrl: './cheetah.component.html',
  styleUrls: ["./cheetah.component.css"],
  standalone:false,
})

export class CheetahComponent implements BaseComponent, OnInit, AfterViewInit, OnDestroy {

  // Reference to the tooltip element in the template. Using @ViewChild instead of
  // document.getElementById() keeps the lookup scoped to THIS component instance, so
  // multiple Cheetah dialogs could coexist without clashing over a shared DOM id.
  @ViewChild('cheetahAboutTooltip') private tooltipRef?:ElementRef<HTMLElement>;

  private _processIdService!:ProcessIDService;
  private _runningProcessService!:RunningProcessService;
  private _audioService!:AudioService;
  private _windowService!:WindowService;
  private _themeService!:ThemeService;
  private _renderer:Renderer2;

  // Tracks the system dark/light theme so the About dialog can recolor. Bound
  // to the host as `theme-dark`; the existing light styling is the CSS default.
  @HostBinding('class.theme-dark') isDarkTheme = false;
  private _themeChangeSub!:Subscription;

  // Timer handles. Tracked so they can be cancelled on destroy (and before re-starting),
  // preventing leaked timers and callbacks that run against an already torn-down view.
  private infoMessageTimeOutId?:NodeJS.Timeout;
  private fancyLetterIntervalId?:ReturnType<typeof setInterval>;

  isDialog = true;
  isVisible = false;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}cheetah.png`;
  cheetahIcon = `${Constants.IMAGE_BASE_PATH}cheetah-midsprint-dash.jpg`;
  processId = 0;
  type = ComponentType.System;
  displayName = 'CheetahOS';
  readonly name = 'cheetah';

  // Single source of truth for the OS version, reused by the header and the info tooltip.
  version = `Version: ${Constants.OS_VERSION}`;
  year = `\u00A9 ${new Date().getFullYear()}`;
  infoMessage = Constants.EMPTY_STRING;

  readonly defaultAudio = `${Constants.AUDIO_BASE_PATH}about_cheetah.mp3`;

  constructor(processIdService:ProcessIDService,  runningProcessService:RunningProcessService, audioService:AudioService, windowService:WindowService, themeService:ThemeService, renderer:Renderer2) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._audioService = audioService;
    this._windowService = windowService;
    this._themeService = themeService;
    this._renderer = renderer;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());

    this.isDarkTheme = !this._themeService.isLightTheme();
    this._themeChangeSub = this._themeService.themeChange.subscribe(() => {
      this.isDarkTheme = !this._themeService.isLightTheme();
    });
  }

  async ngOnInit(): Promise<void> {
    const delay = 5; //5ms
    await CommonFunctions.sleep(delay)
    await this._audioService.play(this.defaultAudio);
  }

   async ngAfterViewInit(): Promise<void> {    
    await CommonFunctions.sleep(5); //delay of 5ms to ensure the view is fully initialized before manipulating it 
    this.getInfoMessage();
  }

  // Clean up any outstanding timers so nothing fires after the component is destroyed
  // (prevents leaked timers and callbacks touching a view that no longer exists).
  ngOnDestroy(): void {
    clearTimeout(this.infoMessageTimeOutId);
    clearInterval(this.fancyLetterIntervalId);
    this._themeChangeSub?.unsubscribe();
  }

  getInfoMessage():void{
    this.infoMessage =`
CheetahOS
Version ${Constants.OS_VERSION}.${Constants.OS_BUILD}
Copyright\u00A9 Chinonso098 2022 - ${new Date().getFullYear()}

Windows 10 icons and audio files are \u00A9 Microsoft Corporation. All rights reserved.
Windows\u2122 is a trademark of the Microsoft group of companies and is used herein for identification purposes only.
This product is not affiliated with, endorsed by, or sponsored by Microsoft Corporation.
All other trademarks, service marks, and logos are the property of their respective owners.
    `
  }

  onMouseEnter1():void{
    // Hovering the tooltip itself should only keep an already-visible tooltip open.
    // If it's hidden, do nothing (don't re-show it just because the cursor grazed
    // the now-invisible tooltip region). The pending-hide cancellation happens inside
    // onMouseEnter so both enter paths share the same logic.
    const showFancyLetters = false;
    if(!this.isVisible)
        return;

    this.onMouseEnter(showFancyLetters);
  }

  onMouseEnter(showFancyLetters = true):void{
    // Cancel any hide that was scheduled by a previous onMouseLeave. Without this,
    // re-entering the icon (or cursor jitter on its edge) leaves a stale 3s timer
    // running that later fires and hides the tooltip "as soon as" the mouse moves away.
    clearTimeout(this.infoMessageTimeOutId);

    const aboutToolTip = this.tooltipRef?.nativeElement;
    if(aboutToolTip){
      this._renderer.setStyle(aboutToolTip, 'zIndex', '3');
      this._renderer.setStyle(aboutToolTip, 'opacity', '1');
      this._renderer.setStyle(aboutToolTip, 'transition', 'opacity 0.5s ease');
    }
    this.isVisible = true;

    if(showFancyLetters)
      this.fancyLetterEffect();
  }

   onMouseLeave():void{
    // Clear any previously scheduled hide first so timers can't stack up; otherwise
    // an earlier timer could still fire and hide the tooltip unexpectedly.
    clearTimeout(this.infoMessageTimeOutId);

    const delay = 3000; // wait 3 sec
    const aboutToolTip = this.tooltipRef?.nativeElement;

    this.infoMessageTimeOutId = setTimeout(() => {
      if(aboutToolTip){
        this._renderer.setStyle(aboutToolTip, 'zIndex', '-1');
        this._renderer.setStyle(aboutToolTip, 'opacity', '0');
        this._renderer.setStyle(aboutToolTip, 'transition', 'opacity 0.75s ease 1');
      }
      this.isVisible = false;
    }, delay); 
  }

  fancyLetterEffect(): void {
    // Cancel any in-flight animation so rapid re-hovers don't spawn competing
    // intervals that fight over `displayName` and cause flicker.
    clearInterval(this.fancyLetterIntervalId);

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const text = 'CheetahOS';
    const delay = 50;
    let counter = 0;

    this.fancyLetterIntervalId = setInterval(() => {
      let displayed = Constants.EMPTY_STRING;

      for (let i = 0; i < text.length; i++) {
        if (i < counter) {
          displayed += text[i];
        } else {
          const randomIndex = Math.floor(Math.random() * LETTERS.length);
          displayed += LETTERS[randomIndex];
        }
      }

      this.displayName = displayed;
      counter += 0.5;

      if (counter > text.length) {
        clearInterval(this.fancyLetterIntervalId);
      }
    }, delay);
  }


  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId 
      && this._windowService.getIsWindowInFocus()) return;
      
    this._windowService.focusOnCurrentProcessWindowNotify.next(this.processId);
  }

  silenceCtxEvt(evt?:MouseEvent):void{
    // Right-clicking anywhere on the App (outside the header row,
    // which opens our own column menu) should NOT pop the desktop's context
    // menu.
    //  - preventDefault(): suppress the native browser context menu.
    //  - stopPropagation(): keep the event from reaching the desktop root.
    evt?.preventDefault();
    evt?.stopPropagation();
  }
  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}