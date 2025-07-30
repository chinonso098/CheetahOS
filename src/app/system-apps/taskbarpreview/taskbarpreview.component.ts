import { Component, Input, OnInit, AfterViewInit} from '@angular/core';
import { TaskBarPreviewImage } from './taskbar.preview';
import { trigger, state, style, animate, transition } from '@angular/animations'
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';

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

  @Input() name = '';
  @Input() icon = '';
  @Input() fadeState = '';

  componentImages:TaskBarPreviewImage[] = [];

  constructor(windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
    this.fadeState = 'in';
  }

  ngOnInit():void{
    this.componentImages = this._windowServices.getProcessPreviewImages(this.name);
  }

  ngAfterViewInit():void{
    const delay = 5;
    setTimeout(() => {
      this.checkForUpdatedTaskBarPrevInfo();
    }, delay);
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
      const tmpInfo = this._systemNotificationService.getAppIconNotication(cmptImage.pid);
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
