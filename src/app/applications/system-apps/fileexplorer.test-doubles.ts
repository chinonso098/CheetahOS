import { Provider } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';

import { FileService } from 'src/app/shared/system-service/file.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { QuickAccessService } from 'src/app/shared/system-service/quick.access.service';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { ClipboardService } from 'src/app/application-services/clipboard.service';
import { ThemeService } from 'src/app/shared/system-theme/theme';

import { Constants } from 'src/app/system-files/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Test doubles for the sixteen services both File Explorer components inject.
 * Only the members the components actually call are stubbed; anything missing
 * surfaces as a loud "not a function" rather than silent wrong behaviour.
 */
export interface FileExplorerTestDoubles {
  fileService:any;
  systemNotificationService:any;
  userNotificationService:any;
  menuService:any;
  clipboardService:any;
  defaultService:any;
  themeService:any;
  themeChange$:Subject<string>;
  providers:Provider[];
}

export const createFileExplorerTestDoubles = ():FileExplorerTestDoubles => {
  const themeChange$ = new Subject<string>();

  const fileService = {
    dirFilesUpdateNotify: new Subject<void>(),
    fetchDirectoryDataNotify: new Subject<string>(),
    goToDirectoryNotify: new Subject<string>(),
    getEventOriginator: jest.fn().mockReturnValue(Constants.EMPTY_STRING),
    addEventOriginator: jest.fn(),
    removeEventOriginator: jest.fn(),
    loadDirectoryFiles: jest.fn().mockResolvedValue([]),
    getStatAsync: jest.fn().mockResolvedValue({ exists:true, isDirectory:true }),
    deleteAsync: jest.fn().mockResolvedValue(true),
    moveAsync: jest.fn().mockResolvedValue(true),
    writeFilesAsync: jest.fn().mockResolvedValue(true),
    countFolderItems: jest.fn().mockResolvedValue(0),
    addDragAndDropFile: jest.fn(),
    removeDragAndDropFile: jest.fn(),
    getDragAndDropFile: jest.fn().mockReturnValue([]),
    unmountZip: jest.fn(),
  };

  const systemNotificationService = {
    taskBarIconInfoChangeNotify: new Subject<unknown>(),
    setDropEventInfo: jest.fn(),
    getDragEventInfo: jest.fn().mockReturnValue(null),
    removeDragEventInfo: jest.fn(),
    removeAppIconNotication: jest.fn(),
  };

  const userNotificationService = { showErrorNotification: jest.fn() };

  const menuService = { closeContextMenu: new Subject<string>(), resetStoreData: jest.fn() };

  const clipboardService = { addFileEntry: jest.fn() };

  const defaultService = {
    defaultSettingsChangeNotify: new Subject<string>(),
    getDefaultSetting: jest.fn().mockReturnValue(Constants.EMPTY_STRING),
  };

  const themeService = {
    isLightTheme: jest.fn().mockReturnValue(false),
    themeChange: themeChange$.asObservable(),
  };

  const providers:Provider[] = [
    FormBuilder,
    { provide: FileService, useValue: fileService },
    { provide: SystemNotificationService, useValue: systemNotificationService },
    { provide: UserNotificationService, useValue: userNotificationService },
    { provide: MenuService, useValue: menuService },
    { provide: ClipboardService, useValue: clipboardService },
    { provide: DefaultService, useValue: defaultService },
    { provide: ThemeService, useValue: themeService },
    { provide: ProcessIDService, useValue: { getNewProcessId: jest.fn().mockReturnValue(1) } },
    { provide: RunningProcessService, useValue: { addProcess: jest.fn(), removeProcess: jest.fn() } },
    { provide: ProcessHandlerService, useValue: { startApplicationProcess: jest.fn(), getLastProcessTrigger: jest.fn().mockReturnValue(undefined) } },
    { provide: SessionManagementService, useValue: { addAppSession: jest.fn(), getAppSession: jest.fn().mockReturnValue(null), removeAppSession: jest.fn() } },
    { provide: WindowService, useValue: { focusOnCurrentProcessWindowNotify: new Subject<number>(), getProcessWindowIDWithHighestZIndex: jest.fn().mockReturnValue(1) } },
    { provide: AudioService, useValue: { play: jest.fn().mockResolvedValue(undefined) } },
    { provide: ActivityHistoryService, useValue: { addActivity: jest.fn() } },
    { provide: QuickAccessService, useValue: { getQuickAccessFiles: jest.fn().mockReturnValue([]) } },
  ];

  return {
    fileService, systemNotificationService, userNotificationService, menuService,
    clipboardService, defaultService, themeService, themeChange$, providers,
  };
};
