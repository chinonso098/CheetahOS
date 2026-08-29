import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, SimpleChanges } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { AngularDraggableModule } from 'angular2-draggable';

import { SecondaryWindowComponent } from './secondarywindow.component';
import { WindowService } from 'src/app/shared/system-service/window.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { WindowConstants } from '../window.constants';

describe('SecondaryWindowComponent', () => {
  let component: SecondaryWindowComponent;
  let fixture: ComponentFixture<SecondaryWindowComponent>;
  let windowService: WindowService;
  let runningProcessService: RunningProcessService;

  const APP_NAME = 'properties';
  const WINDOW_PID = 202;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SecondaryWindowComponent],
      imports: [NoopAnimationsModule, DragDropModule, AngularDraggableModule],
      providers: [
        // The only heavyweight dependency: it transitively pulls in FileService
        // and the BrowserFS bootstrap, which this component never exercises.
        { provide: ProcessHandlerService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    windowService = TestBed.inject(WindowService);
    runningProcessService = TestBed.inject(RunningProcessService);

    fixture = TestBed.createComponent(SecondaryWindowComponent);
    component = fixture.componentInstance;
    component.runningProcessID = WINDOW_PID;
    component.processAppName = APP_NAME;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adopts its inputs and registers the window under a name-pid unique id', () => {
    const newProcessNames: string[] = [];
    runningProcessService.newProcessNotify.subscribe((n) => newProcessNames.push(n));

    component.ngOnInit();

    expect(component.processId).toBe(WINDOW_PID);
    expect(component.uniqueId).toBe(`${APP_NAME}-${WINDOW_PID}`);
    expect(newProcessNames).toContain(`${APP_NAME}-${WINDOW_PID}`);
  });

  it('titles itself with the dialog message only while in dialog mode', () => {
    component.displayMessage = 'Delete file?';

    component.isDialog = false;
    component.ngOnChanges({} as SimpleChanges);
    expect(component.displayName).toBe(APP_NAME);

    component.isDialog = true;
    component.ngOnChanges({} as SimpleChanges);
    expect(component.displayName).toBe('Delete file?');
  });

  it('closes itself when the window service targets its own process id', () => {
    const closeSpy = jest.spyOn(component, 'closeWindow').mockImplementation(() => undefined);
    component.ngOnInit();

    windowService.closeWindowProcessNotify.next(WINDOW_PID + 1);
    expect(closeSpy).not.toHaveBeenCalled();

    windowService.closeWindowProcessNotify.next(WINDOW_PID);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    closeSpy.mockRestore();
  });

  it('drops out of sight while the lock screen is up and comes back with the desktop', () => {
    component.ngOnInit();
    windowService.addWindowState({
      appName: APP_NAME,
      pId: WINDOW_PID,
      widthPx: 400,
      heightPx: 300,
      leftPx: 0,
      topPx: 0,
      zIndex: WindowConstants.MAX_Z_INDEX,
      isVisible: true,
    });
    windowService.addProcessWindowIDWithHighestZIndex(WINDOW_PID);

    component.lockScreenIsActive();
    expect(component.currentWinStyles['opacity']).toBe(0);
    expect(component.currentWinStyles['z-index']).toBe(WindowConstants.HIDDEN_Z_INDEX);

    component.desktopIsActive();
    expect(component.currentWinStyles['opacity']).toBe(1);
    expect(component.currentWinStyles['z-index']).toBe(WindowConstants.MAX_Z_INDEX);
  });
});
