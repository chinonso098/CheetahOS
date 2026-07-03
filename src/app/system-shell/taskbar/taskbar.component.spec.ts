import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

import { TaskbarComponent } from './taskbar.component';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { Constants } from 'src/app/system-files/constants';

describe('TaskbarComponent', () => {
  let component: TaskbarComponent;
  let fixture: ComponentFixture<TaskbarComponent>;

  // Minimal stubs: the component only assigns a process id, registers a process,
  // and subscribes to / emits on the subjects below, so light fakes are enough.
  const processIdServiceStub = {
    getNewProcessId: () => 1,
  };
  const runningProcessServiceStub = {
    addProcess: () => undefined,
    getEventOriginator: () => Constants.EMPTY_STRING,
    addEventOriginator: () => undefined,
  };
  const menuServiceStub = {
    hideStartMenu: new Subject<void>(),
    showStartMenu: new Subject<void>(),
    hideSearchBox: new Subject<string>(),
    showSearchBox: new Subject<void>(),
    hideContextMenus: new Subject<string>(),
    showTaskBarConextMenu: new Subject<MouseEvent>(),
  };
  const systemNotificationServiceStub = {
    showLockScreenNotify: new Subject<void>(),
    showDesktopNotify: new Subject<void>(),
    showTaskBarNotify: new Subject<void>(),
    hideTaskBarNotify: new Subject<void>(),
    showTaskBarToolTipNotify: new Subject<unknown>(),
    hideTaskBarToolTipNotify: new Subject<void>(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskbarComponent],
      imports: [NoopAnimationsModule],
      providers: [
        { provide: ProcessIDService, useValue: processIdServiceStub },
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
        { provide: MenuService, useValue: menuServiceStub },
        { provide: SystemNotificationService, useValue: systemNotificationServiceStub },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('drives taskbar opacity from lock-screen / desktop notifications', () => {
    component.lockScreenIsActive();
    expect(component.taskBarOpacity).toBe(0);

    component.desktopIsActive();
    expect(component.taskBarOpacity).toBe(1);
  });

  it('collapses the search box when toggled while already open', async () => {
    component.isSearchWindowVisible = true;

    await component.hideShowSearch(new MouseEvent('click'));

    expect(component.isSearchWindowVisible).toBe(false);
  });
});
