import { Component, Input, OnInit, AfterViewInit, OnDestroy} from '@angular/core';
import { TaskBarPreviewImage } from './taskbar.preview';
import { trigger, state, style, animate, transition } from '@angular/animations'
import { WindowService } from 'src/app/shared/system-service/window.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Subscription } from 'rxjs';
@Component({
  selector: 'cos-taskbarpreview',
  templateUrl: './taskbarpreview.component.html',
  styleUrl: './taskbarpreview.component.css',
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

  private _highLightTaskBarPreviewSub!: Subscription;
  private _unHighLightTaskBarPreviewSub!: Subscription;

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

  ngOnDestroy():void{
    this._highLightTaskBarPreviewSub?.unsubscribe();
    this._unHighLightTaskBarPreviewSub?.unsubscribe();
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
  }
}
