import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { SnippingToolComponent } from './snippingtool.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { FileService } from 'src/app/shared/system-service/file.service';
import { UserNotificationService } from 'src/app/shared/system-service/user.notification.service';

describe('SnippingToolComponent', () => {
  let component: SnippingToolComponent;
  let fixture: ComponentFixture<SnippingToolComponent>;

  // FileService boots BrowserFS and ProcessHandlerService owns the launch
  // pipeline; both are replaced with the members the component actually uses.
  const fileServiceStub = {
    writeFileAsync: jest.fn().mockResolvedValue(true),
    resolveContentPath: () => '',
  };
  const processHandlerServiceStub = {
    getLastProcessTrigger: () => undefined,
    runApplication: jest.fn(),
  };
  const userNotificationServiceStub = {
    showInfoNotification: jest.fn(),
    showErrorNotification: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SnippingToolComponent],
      providers: [
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
        { provide: FileService, useValue: fileServiceStub },
        { provide: UserNotificationService, useValue: userNotificationServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnippingToolComponent);
    component = fixture.componentInstance;
    // ngAfterViewInit grabs a 2D canvas context and loads the trigger image,
    // so the view is intentionally left un-initialised.
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('snippingtool');
  });

  it('opens one toolbar menu at a time and closes them all on a document click', () => {
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.togglePenMenu(evt);
    expect(component.showPenMenu).toBe(true);

    component.toggleShapeMenu(evt);
    expect(component.showShapeMenu).toBe(true);
    expect(component.showPenMenu).toBe(false);

    // Clicking the same button again closes it.
    component.toggleShapeMenu(evt);
    expect(component.showShapeMenu).toBe(false);

    component.toggleModeMenu(evt);
    component.onDocumentClick();
    expect(component.showModeMenu).toBe(false);
  });

  it('labels the selected capture mode and delay', () => {
    const firstMode = component.captureModes[0];

    component.selectMode(firstMode.mode);
    expect(component.selectedModeLabel).toBe(firstMode.label);

    component.selectDelay(0);
    expect(component.selectedDelayLabel).toBe('No delay');

    component.selectDelay(5);
    expect(component.selectedDelayLabel).toBe('5-second delay');
    // Choosing an item also dismisses the open menu.
    expect(component.showDelayMenu).toBe(false);
  });

  it('steps the zoom level through its preset stops and clamps at both ends', () => {
    const steps = component.zoomSteps;

    component.setZoom(steps[0]);
    component.zoomOut();
    expect(component.zoom).toBe(steps[0]);

    component.zoomIn();
    expect(component.zoom).toBe(steps[1]);
    expect(component.zoomLabel).toBe(`${Math.round(steps[1] * 100)}%`);

    component.setZoom(steps[steps.length - 1]);
    component.zoomIn();
    expect(component.zoom).toBe(steps[steps.length - 1]);
    expect(component.showZoomMenu).toBe(false);
  });

  it('has nothing to undo or redo before any annotation is drawn', () => {
    expect(component.canUndo).toBe(false);
    expect(component.canRedo).toBe(false);

    // Both are no-ops without a history, so they must not throw.
    expect(() => component.undo()).not.toThrow();
    expect(() => component.redo()).not.toThrow();
    expect(component.canUndo).toBe(false);
  });
});
