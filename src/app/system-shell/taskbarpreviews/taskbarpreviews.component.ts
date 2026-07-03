import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { CommonFunctions } from 'src/app/system-files/commons/common.functions';

import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-taskbarpreviews',
  templateUrl: './taskbarpreviews.component.html',
  styleUrl: './taskbarpreviews.component.css',
  // eslint-disable-next-line @angular-eslint/prefer-standalone
  standalone:false,
})
export class TaskbarpreviewsComponent implements OnInit, OnDestroy {

  private _runningProcessService:RunningProcessService;
  private _systemNotificationService:SystemNotificationService;
  private _windowServices:WindowService;

  private _highLightTaskBarPreviewSub!: Subscription;
  private _unHighLightTaskBarPreviewSub!: Subscription;

  // Set once the component is destroyed, so work scheduled to run after an
  // `await` (see showOrSetWindowToFocusOnClick) can bail out instead of
  // emitting against a torn-down preview.
  private _isDestroyed = false;

  @Input() icon = Constants.EMPTY_STRING;
  @Input() name = Constants.EMPTY_STRING;
  @Input() imageData = Constants.EMPTY_STRING;
  @Input() pId = 0;

  // Truncated copy of `name` shown in the preview header.
  appInfo = Constants.EMPTY_STRING;

  // Drives every "highlighted" visual (tile background, revealed close button
  // and svg glyph) via the host element's `is-highlighted` CSS class. Keeping
  // this model-driven means no component code writes styles onto DOM nodes.
  @HostBinding('class.is-highlighted') isHighlighted = false;

  // Delay (ms) that lets the hide/restore of preview windows settle before the
  // clicked window is brought to focus.
  private static readonly FOCUS_ON_CLICK_DELAY_MS = 100;

  // Max characters of the app name shown before it is truncated with an ellipsis.
  private static readonly APP_NAME_CHAR_LIMIT = 30;


  constructor(runningProcessService:RunningProcessService, windowServices:WindowService, systemNotificationService:SystemNotificationService){
    this._runningProcessService = runningProcessService;
    this._windowServices = windowServices;
    this._systemNotificationService = systemNotificationService;
  }

  ngOnInit():void{
    // Subscribe in ngOnInit (not the constructor) so the component's @Input()
    // values — notably `pId`, used to match highlight notifications — are
    // already populated by the time a notification handler runs.
    this._highLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewHighlightNotify.subscribe((uId) => this.highlightTaskBarPreview(uId));
    this._unHighLightTaskBarPreviewSub = this._systemNotificationService.taskBarPreviewUnHighlightNotify.subscribe((uId) => this.unHighlightTaskBarPreview(uId));

    // The app name is known as soon as inputs are bound, so build the
    // truncated display string here (no post-view delay needed).
    this.setShortAppInfo();
  }

  ngOnDestroy(): void {
    this._isDestroyed = true;
    this._highLightTaskBarPreviewSub?.unsubscribe();
    this._unHighLightTaskBarPreviewSub?.unsubscribe();
  }

  // Builds `appInfo` from `name`, truncating long names with an ellipsis.
  private setShortAppInfo():void{
    const ellipsis = '...';
    const limit = TaskbarpreviewsComponent.APP_NAME_CHAR_LIMIT;

    this.appInfo = (this.name.length > limit)
      ? this.name.substring(0, limit) + ellipsis
      : this.name;
  }

  onClosePreviewWindow(pId:number):void{
    const processToClose = this._runningProcessService.getProcess(pId);
    // The process may already be gone (e.g. closed elsewhere); avoid emitting
    // an undefined process onto the close stream.
    if(!processToClose) return;

    // Undo any hover-peek applied to this window and dismiss the preview
    // fly-out. Without this the TaskbarMenuHandler only hides the preview on
    // the container's mouseleave, so the fly-out would linger on screen until
    // the user moved the mouse away after clicking close.
    this.restoreWindowOnMouseLeave(pId);
    this.hideTaskBarPreviewWindowAndRestoreDesktop();

    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  // Placeholder for the (not-yet-implemented) preview context menu. The
  // template's (contextmenu) binding stays wired so the feature can be added
  // later without touching the markup.
  showTaskBarPreviewContextMenu(evt:MouseEvent, pId:number):void{
    // intentionally empty for now
  }

  setWindowToFocusOnMouseHover(pId:number):void{
    // Bring the matching window forward while the mouse is over the preview.
    // The close button / svg reveal is handled purely by CSS (:host hover).
    this._windowServices.setProcessWindowToFocusOnMouseHoverNotify.next(pId);
  }

  restoreWindowOnMouseLeave(pId:number):void{
    this._windowServices.restoreProcessWindowOnMouseLeaveNotify.next(pId);
  }

  async showOrSetWindowToFocusOnClick(pId:number): Promise<void>{
    this.restoreWindowOnMouseLeave(pId);
    this.hideTaskBarPreviewWindowAndRestoreDesktop();

    await CommonFunctions.sleep(TaskbarpreviewsComponent.FOCUS_ON_CLICK_DELAY_MS);
    // The preview (and this component) may have been torn down during the await.
    if(this._isDestroyed) return;

    this._windowServices.showOrSetProcessWindowToFocusOnClickNotify.next(pId);
  }

  // Hides the preview fly-out and restores any minimized desktop windows.
  private hideTaskBarPreviewWindowAndRestoreDesktop():void{
    this._windowServices.hideProcessPreviewWindowNotify.next();
    this._windowServices.restoreProcessesWindowNotify.next();
  }

  // Highlight notifications carry a unique id of the form `${appName}-${pId}`.
  // Only the preview whose pId matches should light up.
  private highlightTaskBarPreview(uId: string): void {
    if(this.isNotificationForThisPreview(uId)){
      this.isHighlighted = true;
    }
  }

  private unHighlightTaskBarPreview(uId:string):void{
    if(this.isNotificationForThisPreview(uId)){
      this.isHighlighted = false;
    }
  }

  // Compares the pId embedded in a notification id with this preview's pId.
  // The pId is taken from the LAST dash segment, since an app name may itself
  // contain dashes (e.g. "code-editor-123").
  private isNotificationForThisPreview(uId:string):boolean{
    const targetPid = Number(uId.substring(uId.lastIndexOf(Constants.DASH) + 1));
    return targetPid === this.pId;
  }

}
