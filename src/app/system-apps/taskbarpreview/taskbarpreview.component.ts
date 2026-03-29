import { Component, Input, OnInit, AfterViewInit} from '@angular/core';
import { TaskBarPreviewImage } from './taskbar.preview';
import { trigger, state, style, animate, transition } from '@angular/animations'
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';
import { CommonFunctions } from 'src/app/system-files/common.functions';

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
export class TaskBarPreviewComponent implements OnInit, AfterViewInit {
  private _systemNotificationService:SystemNotificationService
  private _windowServices:WindowService;

  @Input() name = Constants.EMPTY_STRING;
  @Input() icon = Constants.EMPTY_STRING;
  @Input() fadeState = Constants.EMPTY_STRING;

  componentImages:TaskBarPreviewImage[] = [];

  constructor(windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this.fadeState = 'in';
  }

  ngOnInit():void{
    this.componentImages = this._windowServices.getProcessPreviewImages(this.name);
  }

  async ngAfterViewInit(): Promise<void>{
    const delay = 5;
    await CommonFunctions.sleep(delay);
    this.checkForUpdatedTaskBarPrevInfo();
  }

  keepTaskBarPreviewWindow():void{
    this._windowServices.keepProcessPreviewWindowNotify.update(v => v + 1);
  }

  hideTaskBarPreviewWindowAndRestoreDesktop():void{
    this._windowServices.hideProcessPreviewWindowNotify.update(v => v + 1);
    this._windowServices.restoreProcessesWindowNotify.update(v => v + 1);
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
