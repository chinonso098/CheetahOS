import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { TerminalComponent } from './terminal.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { SystemMetricService } from 'src/app/shared/system-service/system.metrics.sservice';
import { FileInfo } from 'src/app/system-files/fs/file.info';

describe('TerminalComponent', () => {
  let component: TerminalComponent;
  let fixture: ComponentFixture<TerminalComponent>;

  // FileService boots BrowserFS and the metric/history services poll the
  // system, so all three are replaced with inert stubs. Everything else the
  // terminal needs (process, window, session, theme, notification services)
  // is dependency-light and used for real.
  const fileServiceStub = {
    resolveContentPath: () => '',
    getFileAsTextAsync: () => Promise.resolve(''),
    loadDirectoryFiles: () => Promise.resolve([]),
  };
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => new FileInfo(),
    runApplication: jest.fn(),
  };
  const activityHistoryServiceStub = {
    getActivitesHistory: () => [],
    getActivityHistory: () => [],
  };
  const systemMetricServiceStub = {
    updateInformationNotify: new Subject<unknown>(),
    getMetrics: () => [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TerminalComponent],
      // The command input is driven by a reactive FormGroup.
      imports: [ReactiveFormsModule],
      providers: [
        { provide: FileService, useValue: fileServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: ActivityHistoryService, useValue: activityHistoryServiceStub },
        { provide: SystemMetricService, useValue: systemMetricServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminalComponent);
    component = fixture.componentInstance;
    // ngOnInit builds the form and the command list; ngAfterViewInit starts the
    // welcome-message typewriter interval, so detectChanges() is avoided.
    component.ngOnInit();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('terminal');
  });

  it('recognises built-in commands and ignores unknown or blank input', () => {
    expect(component.allCommands.length).toBeGreaterThan(0);

    const known = component.allCommands[0];
    expect(component.isValidCommand(known)).toBe(true);
    expect(component.isValidCommand('definitely-not-a-command')).toBe(false);

    expect(component.stringIsOnlyWhiteSpace('   ')).toBe(true);
    expect(component.stringIsOnlyWhiteSpace(' ls ')).toBe(false);
    expect(component.isOption('-r')).toBe(true);
    expect(component.isOption('report')).toBe(false);
  });

  it('parses path fragments for tab completion', () => {
    expect(component.countSlahesInPath('Games/Data/In')).toBe(2);
    expect(component.countSlahesInPath('Games')).toBe(0);

    expect(component.getLastSegment('Games/Data/In')).toBe('In');
    expect(component.getLastSegment('Games/Data/')).toBe('Data');
    expect(component.getLastSegment('Games')).toBe('Games');

    expect(component.stripAfterSlash('Documents/Sample')).toBe('Documents');
    expect(component.checkForCharAfterSlashRegex('Documents/S')).toBe(true);
    expect(component.checkForCharAfterSlashRegex('Documents/')).toBe(false);
    expect(component.checkForWhitSpaceAtTheEnd('cd Games ')).toBe(true);
    expect(component.checkForWhitSpaceAtTheEnd('cd Games')).toBe(false);
  });

  it('suggests only the candidates sharing the typed prefix', () => {
    const candidates = ['clear', 'copy', 'curl', 'ls'];

    expect(component.getAutoCompelete('c', candidates)).toEqual(['clear', 'copy', 'curl']);
    expect(component.getAutoCompelete(' cl ', candidates)).toEqual(['clear']);
    expect(component.getAutoCompelete('zzz', candidates)).toEqual([]);
  });

  it('walks the command history backwards and forwards from the input box', () => {
    component.commandHistory = [
      { getCommand: 'ls' },
      { getCommand: 'pwd' },
    ] as any;
    (component as any).prevPtrIndex = component.commandHistory.length;

    component.getCommandHistory('backward');
    expect(component.terminalForm.value.terminalCmd).toBe('pwd');

    component.getCommandHistory('backward');
    expect(component.terminalForm.value.terminalCmd).toBe('ls');

    // Walking past the newest entry clears the input again.
    component.getCommandHistory('forward');
    component.getCommandHistory('forward');
    expect(component.terminalForm.value.terminalCmd).toBe('');
  });
});
