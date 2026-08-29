import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { OverFlowComponent } from './overflow.component';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { SystemNotificationService } from 'src/app/shared/system-service/system.notification.service';
import { FileIndexerService } from 'src/app/shared/system-service/file.indexer.services';
import { InformationUpdate } from 'src/app/system-files/commons/common.interfaces';

describe('OverFlowComponent', () => {
  let component: OverFlowComponent;
  let fixture: ComponentFixture<OverFlowComponent>;
  let systemNotificationService: SystemNotificationService;

  const runningApps = new Set<string>();
  const runningProcessServiceStub = {
    processListChangeNotify: new Subject<void>(),
    isProcessRunning: (appName: string) => runningApps.has(appName),
    addProcess: () => undefined,
    addService: () => undefined,
  };
  const fileIndexerServiceStub = {
    IndexingInProgress: new Subject<boolean>(),
  };

  const cpuUpdate = (value: string): InformationUpdate =>
    ({ appName: 'taskmanager', pId: 0, info: [`cpu: ${value}`] }) as unknown as InformationUpdate;

  beforeEach(async () => {
    runningApps.clear();

    await TestBed.configureTestingModule({
      declarations: [OverFlowComponent],
      providers: [
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
        { provide: FileIndexerService, useValue: fileIndexerServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    systemNotificationService = TestBed.inject(SystemNotificationService);

    fixture = TestBed.createComponent(OverFlowComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reveals the chatter and task-manager icons only while those apps are running', async () => {
    runningApps.add('chatter');
    runningApps.add('taskmanager');
    runningProcessServiceStub.processListChangeNotify.next();
    await Promise.resolve();

    expect(component.showChatterIcon).toBe(true);
    expect(component.showTskMngrUtil).toBe(true);

    runningApps.clear();
    component.hideShowChatter();
    await component.hideShowTaskManagerUtil();

    expect(component.showChatterIcon).toBe(false);
    expect(component.showTskMngrUtil).toBe(false);
  });

  it('tracks the CPU utilization published by the task manager', () => {
    systemNotificationService.updateInformationNotify.next(cpuUpdate('37'));

    expect(component.tskMngrUtil).toBe(37);
  });

  it('keeps the last good utilization when a malformed update arrives', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    component.tskMngrUtil = 37;

    component.updateTaskManager({ appName: 'taskmanager', pId: 0, info: ['no-colon'] } as unknown as InformationUpdate);
    component.updateTaskManager(cpuUpdate('not-a-number'));

    expect(component.tskMngrUtil).toBe(37);
    warnSpy.mockRestore();
  });

  it('shows the indexing spinner while the file indexer is working', () => {
    fileIndexerServiceStub.IndexingInProgress.next(true);
    expect(component.showIndexingIcon).toBe(true);

    fileIndexerServiceStub.IndexingInProgress.next(false);
    expect(component.showIndexingIcon).toBe(false);
  });
});
