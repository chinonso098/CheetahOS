import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { TaskbarpreviewsComponent } from './taskbarpreviews.component';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { WindowService } from 'src/app/shared/system-service/window.service';

describe('TaskbarpreviewsComponent', () => {
  let component: TaskbarpreviewsComponent;
  let fixture: ComponentFixture<TaskbarpreviewsComponent>;

  // Minimal stubs: the component only stores these services and emits on / reads
  // from the subjects below, so empty subjects are enough for it to construct.
  const runningProcessServiceStub = {
    getProcess: () => undefined,
    closeProcessNotify: new Subject<unknown>(),
  };
  const windowServiceStub = {
    setProcessWindowToFocusOnMouseHoverNotify: new Subject<number>(),
    restoreProcessWindowOnMouseLeaveNotify: new Subject<number>(),
    showOrSetProcessWindowToFocusOnClickNotify: new Subject<number>(),
    hideProcessPreviewWindowNotify: new Subject<void>(),
    restoreProcessesWindowNotify: new Subject<void>(),
  };
  const systemNotificationServiceStub = {
    taskBarPreviewHighlightNotify: new Subject<string>(),
    taskBarPreviewUnHighlightNotify: new Subject<string>(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskbarpreviewsComponent],
      providers: [
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
        { provide: WindowService, useValue: windowServiceStub },
        { provide: SystemNotificationService, useValue: systemNotificationServiceStub },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskbarpreviewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('highlights only when the notification pId matches', () => {
    component.pId = 42;
    fixture.detectChanges();

    systemNotificationServiceStub.taskBarPreviewHighlightNotify.next('chrome-99');
    expect(component.isHighlighted).toBe(false);

    systemNotificationServiceStub.taskBarPreviewHighlightNotify.next('chrome-42');
    expect(component.isHighlighted).toBe(true);

    systemNotificationServiceStub.taskBarPreviewUnHighlightNotify.next('chrome-42');
    expect(component.isHighlighted).toBe(false);
  });

  it('truncates long app names for the preview header', () => {
    const appNameCharLimit = 30;
    component.name = 'a'.repeat(appNameCharLimit + 5);
    component.ngOnInit();
    expect(component.appInfo).toBe(`${'a'.repeat(appNameCharLimit)}...`);

    component.name = 'terminal';
    component.ngOnInit();
    expect(component.appInfo).toBe('terminal');
  });

  it('dismisses the fly-out and closes the window when close is clicked', () => {
    const process = { getProcessId: 42 };
    const getProcessSpy = jest.spyOn(runningProcessServiceStub, 'getProcess')
      .mockReturnValue(process as never);
    let closed: unknown;
    let restored = 0;
    runningProcessServiceStub.closeProcessNotify.subscribe((p) => (closed = p));
    windowServiceStub.restoreProcessWindowOnMouseLeaveNotify.subscribe(() => restored++);

    component.onClosePreviewWindow(42);

    expect(closed).toBe(process);
    expect(restored).toBe(1);
    getProcessSpy.mockRestore();
  });

  it('never emits a close for a process that is already gone', () => {
    let closeCount = 0;
    runningProcessServiceStub.closeProcessNotify.subscribe(() => closeCount++);

    component.onClosePreviewWindow(999);

    expect(closeCount).toBe(0);
  });
});
