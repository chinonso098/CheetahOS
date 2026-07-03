/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { ComponentType } from 'src/app/system-files/system.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';
import { BaseComponent } from 'src/app/system-files/base/base.component.interface';

import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';

import { WindowService } from 'src/app/shared/system-service/window.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { ClipboardService, ClipboardEntry } from 'src/app/application-services/clipboard.service';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';

@Component({
  selector: 'cos-clipboard',
  templateUrl: './clipboard.component.html',
  styleUrls: ['./clipboard.component.css'],
  standalone: false,
})
export class ClipboardComponent implements BaseComponent, OnInit, OnDestroy {
  private _processIdService!: ProcessIDService;
  private _runningProcessService!: RunningProcessService;
  private _menuService!: MenuService;
  private _clipboardService!: ClipboardService;
  private _windowService!: WindowService;
  private _userNotificationService!: UserNotificationService;

  private _clipboardSub!: Subscription;

  // Rendered through the secondary window as a flyout (no taskbar entry),
  // mirroring how the Cheetah "about" dialog presents itself.
  isDialog = true;

  hasWindow = false;
  icon = `${Constants.IMAGE_BASE_PATH}clipboard.png`;
  pinIcon = `${Constants.IMAGE_BASE_PATH}pin_24.png`;
  unpinIcon = `${Constants.IMAGE_BASE_PATH}unpin_24.png`;
  readonly name = Constants.CLIPBOARD;
  processId = 0;
  type = ComponentType.System;
  displayName = 'Clipboard';

  entries: ClipboardEntry[] = [];

  constructor(processIdService: ProcessIDService, runningProcessService: RunningProcessService,
    menuService: MenuService, clipboardService: ClipboardService, windowService: WindowService,
    userNotificationService: UserNotificationService) {
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._menuService = menuService;
    this._clipboardService = clipboardService;
    this._windowService = windowService;
    this._userNotificationService = userNotificationService;

    this.processId = this._processIdService.getNewProcessId();
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    // Respect the user's clipboard-history setting. When it's disabled, the
    // flyout has nothing to show, so prompt the user to turn it on instead.
    if (!this._clipboardService.isClipboardEnabled()) {
      const uId = `${this.name}-${this.processId}`;
      this._userNotificationService.showInfoNotification(
        `Clipboard history is turned off. Turn it on in Settings to save items you copy and cut.`, uId);
      return;
    }

    this.entries = this._clipboardService.getEntries();
    this._clipboardSub = this._clipboardService.clipboardChangeNotify.subscribe(() => {
      this.entries = this._clipboardService.getEntries();
    });
  }

  ngOnDestroy(): void {
    this._clipboardSub?.unsubscribe();
  }

  get hasEntries(): boolean {
    return this.entries.length > 0;
  }

  focusWindow(evt?:MouseEvent):void{
    evt?.stopPropagation();

    if(this._windowService.getProcessWindowIDWithHighestZIndex() === this.processId) return;

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

  /**
   * Stage the clicked entry as the active clipboard item (so the next Paste,
   * on the desktop or in file explorer, acts on it) and dismiss the flyout —
   * matching the Windows 10 "click an item to paste it" behaviour.
   */
  onPasteEntry(entry: ClipboardEntry): void {
    this._menuService.setStoreData([entry.path, entry.action]);
    this.closeWindow();
  }

  onTogglePin(evt: MouseEvent, entry: ClipboardEntry): void {
    evt.stopPropagation();
    this._clipboardService.togglePin(entry.id);
  }

  onRemoveEntry(evt: MouseEvent, entry: ClipboardEntry): void {
    evt.stopPropagation();
    this._clipboardService.removeEntry(entry.id);
  }

  onClearAll(): void {
    this._clipboardService.clearAll();
  }

  isCutAction(entry: ClipboardEntry): boolean {
    return entry.action === MenuAction.CUT;
  }

  private closeWindow(): void {
    const processToClose = this._runningProcessService.getProcess(this.processId);
    this._runningProcessService.closeProcessNotify.next(processToClose);
  }

  private getComponentDetail(): Process {
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type);
  }
}
