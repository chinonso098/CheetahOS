import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RunSystemComponent } from './runsystem.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { AppDirectory } from 'src/app/system-files/app.directory';
import { Constants } from 'src/app/system-files/constants';

describe('RunSystemComponent', () => {
  let component: RunSystemComponent;
  let fixture: ComponentFixture<RunSystemComponent>;
  let runningProcessService: RunningProcessService;

  const processHandlerServiceStub = { runApplication: jest.fn() };

  beforeEach(async () => {
    processHandlerServiceStub.runApplication.mockClear();

    await TestBed.configureTestingModule({
      declarations: [RunSystemComponent],
      imports: [FormsModule],
      providers: [{ provide: ProcessHandlerService, useValue: processHandlerServiceStub }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    runningProcessService = TestBed.inject(RunningProcessService);

    fixture = TestBed.createComponent(RunSystemComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists every launchable app and hides the internal ones', () => {
    const appDirectory = new AppDirectory();

    component.ngOnInit();

    expect(component.appList.length).toBeGreaterThan(0);
    for (const hidden of appDirectory.getHiddenApp()) {
      expect(component.appList.some(a => a.name === hidden)).toBe(false);
    }
  });

  it('fills the input from the dropdown and closes it', () => {
    component.ngOnInit();
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.toggleDropdown(evt);
    expect(component.isDropdownOpen).toBe(true);

    component.selectApp(component.appList[0], evt);
    expect(component.inputValue).toBe(component.appList[0].name);
    expect(component.isDropdownOpen).toBe(false);
  });

  it('launches the typed app and closes the dialog on OK', () => {
    let closedPid = -1;
    runningProcessService.closeProcessNotify.subscribe((p) => (closedPid = p.getProcessId));
    component.inputValue = '  texteditor  ';

    component.onOk();

    const launched = processHandlerServiceStub.runApplication.mock.calls[0][0];
    expect(launched.getOpensWith).toBe('texteditor');
    expect(closedPid).toBe(component.processId);
  });

  it('does nothing when OK is pressed with a blank command', () => {
    component.inputValue = Constants.EMPTY_STRING;

    component.onOk();

    expect(processHandlerServiceStub.runApplication).not.toHaveBeenCalled();
  });
});
