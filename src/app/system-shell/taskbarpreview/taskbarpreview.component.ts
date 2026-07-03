import { Component, Input, OnInit, AfterViewInit, HostBinding, OnDestroy} from '@angular/core';
import { TaskBarPreviewImage } from './taskbar.preview';
import { trigger, state, style, animate, transition } from '@angular/animations'
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Subscription } from 'rxjs';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';


@Component({
  selector: 'cos-taskbarpreview',
  templateUrl: './taskbarpreview.component.html',
  styleUrl: './taskbarpreview.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
  animations: [
    trigger('fadeAnimation', [
      state('in', style({ opacity: 1 })),
      state('out', style({ opacity: 0 })),
      transition('* => in', [
        animate('0.30s ease-in')
      ]),
      transition('in => out', [
        animate('0.30s ease-out')
      ]),
    ])
  ]
})
export class TaskBarPreviewComponent implements OnInit, AfterViewInit, OnDestroy {
  private _systemNotificationService:SystemNotificationService
  private _windowServices:WindowService;
  private _defaultService:DefaultService;

  @Input() name = Constants.EMPTY_STRING;
  @Input() icon = Constants.EMPTY_STRING;
  @Input() fadeState = Constants.EMPTY_STRING;

  /** Transparency effects OFF -> solid preview surface, no backdrop blur. */
  @HostBinding('class.solid-surface') isSolidSurface = false;
  /** Preview surface color: accent when the show-accent toggle is ON, else system color. */
  @HostBinding('style.--surface-color') surfaceColor = Constants.DEFAULT_SYSTEM_COLOR;
  /** Tile highlight/hover tint: accent when the show-accent toggle is ON, else neutral. */
  @HostBinding('style.--accent-color') accentColor = Constants.DEFAULT_ACCENT_COLOR_VALUE;
  /** Final revealed/hover tile background. Accent-tinted when ON, darker grey when OFF. */
  @HostBinding('style.--tile-highlight-bg') tileHighlightBg = Constants.EMPTY_STRING;
  @HostBinding('style.--tile-hover-bg') tileHoverBg = Constants.EMPTY_STRING;

  componentImages:TaskBarPreviewImage[] = [];
  private _settingsSub!:Subscription;

  constructor(windowServices:WindowService, systemNotificationService:SystemNotificationService, defaultService:DefaultService){
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this._defaultService = defaultService;
    this.fadeState = 'in';
    this.initSurfaceState();
  }

  ngOnInit():void{
    this.componentImages = this._windowServices.getProcessPreviewImages(this.name);
  }

  ngOnDestroy():void{
    this._settingsSub?.unsubscribe();
  }

  /**
   * Mirrors the taskbar's transparency/accent wiring onto the preview frame.
   * Exposed as `--surface-color` / `--accent-color` custom properties that the
   * child preview tiles inherit (the preview is rendered under the desktop, not
   * inside the taskbar, so it cannot inherit those from the taskbar host).
   */
  private initSurfaceState():void{
    this.applySurfaceState();
    this._settingsSub = this._defaultService.defaultSettingsChangeNotify.subscribe((key:string) => {
      if(key === Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT
        || key === Constants.DEFAULT_ACCENT_COLOR
        || key === Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR){
        this.applySurfaceState();
      }
    });
  }

  private applySurfaceState():void{
    this.isSolidSurface = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_TRANSPARENCY_EFFECT) !== Constants.TRUE;
    const showAccent = this._defaultService.getDefaultSetting(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR) === Constants.TRUE;
    const accent = this._defaultService.getDefaultSetting(Constants.DEFAULT_ACCENT_COLOR);
    this.surfaceColor = showAccent ? accent : Constants.DEFAULT_SYSTEM_COLOR;
    // Only tint the preview tiles with the accent when the show-accent toggle is
    // ON; otherwise fall back to the neutral system color so highlight/hover stay grey.
    this.accentColor = showAccent ? accent : Constants.DEFAULT_SYSTEM_COLOR;
    if(showAccent){
      // Accent-tinted, whitish reveal (highlight slightly darker than hover).
      this.tileHighlightBg = `color-mix(in srgb, color-mix(in srgb, ${accent} 35%, #fff) 62%, transparent)`;
      this.tileHoverBg = `color-mix(in srgb, color-mix(in srgb, ${accent} 30%, #fff) 66%, transparent)`;
    }else{
      // Accent OFF: a darker shade of grey for the revealed/hover tiles.
      this.tileHighlightBg = 'color-mix(in srgb, #4a4a4a 62%, transparent)';
      this.tileHoverBg = 'color-mix(in srgb, #5a5a5a 66%, transparent)';
    }
  }

  async ngAfterViewInit(): Promise<void>{
    const delay = 5;
    await CommonFunctions.sleep(delay);
    this.checkForUpdatedTaskBarPrevInfo();
  }

  keepTaskBarPreviewWindow():void{
    this._windowServices.keepProcessPreviewWindowNotify.next();
  }

  hideTaskBarPreviewWindowAndRestoreDesktop():void{
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this._windowServices.restoreProcessesWindowNotify.next();
  }

  checkForUpdatedTaskBarPrevInfo():void{
    for(const cmptImage of this.componentImages){
      const tmpInfo = this._systemNotificationService.getAppIconNotication(cmptImage.pId);
      if(tmpInfo.length > 0){
        cmptImage.displayName = tmpInfo[0];
        cmptImage.icon = tmpInfo[1];
      }
    }

    //For mergedlist, you will have to search by opensWith/ProcessName to get the pids from runnngSystemSerice
    //A way to differentiate between merged and unMerged is needed ####
    //HMMMMMMM wait this should work regardless....i'll need to look into this
  }
}
