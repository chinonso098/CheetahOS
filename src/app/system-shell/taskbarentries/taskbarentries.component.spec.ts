import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { TaskBarEntriesComponent } from './taskbarentries.component';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';

describe('TaskBarEntriesComponent', () => {
  let component: TaskBarEntriesComponent;
  let fixture: ComponentFixture<TaskBarEntriesComponent>;
  let menuService: MenuService;
  let sessionManagementService: SessionManagementService;
  let runningProcessService: RunningProcessService;

  const APP = 'texteditor';

  const pinnableFile = () => {
    const file = new FileInfo();
    file.setOpensWith = APP;
    file.setIconPath = `${Constants.IMAGE_BASE_PATH}texteditor.png`;
    return file;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskBarEntriesComponent],
      imports: [NoopAnimationsModule],
      providers: [{ provide: ProcessHandlerService, useValue: { runApplication: jest.fn() } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);
    runningProcessService = TestBed.inject(RunningProcessService);
    sessionManagementService = TestBed.inject(SessionManagementService);
    sessionManagementService.removeSession('cheetahTskBarKey');

    fixture = TestBed.createComponent(TaskBarEntriesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    sessionManagementService.removeSession('cheetahTskBarKey');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts in un-merged mode with labelled entries', () => {
    expect(component.isMergedMode).toBe(false);
    expect(component.hideShowLabelState).toBe(component.showLabel);
  });

  it('drops the entry labels when the taskbar is switched to merged mode', () => {
    menuService.mergeTaskBarIcon.next();

    expect(component.isMergedMode).toBe(true);
    expect(component.hideShowLabelState).toBe(component.hideLabel);

    menuService.UnMergeTaskBarIcon.next();
    expect(component.isMergedMode).toBe(false);
    expect(component.hideShowLabelState).toBe(component.showLabel);
  });

  it('pins an app once and persists it as a not-running placeholder', () => {
    component.onPinIconToTaskBarIconList(pinnableFile());
    component.onPinIconToTaskBarIconList(pinnableFile());

    const pinned = component.unMergedTaskBarIconList.filter(x => x.opensWith === APP);
    expect(pinned.length).toBe(1);
    expect(pinned[0].isPinned).toBe(true);

    const persisted = component.sessionPinnedTaskbarIcons;
    expect(persisted.length).toBe(1);
    expect(persisted[0].uId).toBe(`${APP}-0`);
    expect(persisted[0].isRunning).toBe(false);
  });

  it('removes the icon entirely when an un-pinned app is not running', () => {
    jest.spyOn(runningProcessService, 'getProcesses').mockReturnValue([]);
    component.onPinIconToTaskBarIconList(pinnableFile());

    component.onUnPinIconFromTaskBarIconList(pinnableFile());

    expect(component.unMergedTaskBarIconList.some(x => x.opensWith === APP)).toBe(false);
    expect(component.sessionPinnedTaskbarIcons.length).toBe(0);
  });
});
