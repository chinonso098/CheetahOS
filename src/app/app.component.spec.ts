import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppComponent } from './app.component';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from './shared/system-service/running.process.service';
import { ComponentReferenceService } from './shared/system-service/component.reference.service';
import { AudioService } from './shared/system-service/audio.services';
import { SessionManagementService } from './shared/system-service/session.management.service';
import { FileIndexerService } from './shared/system-service/file.indexer.services';
import { DefaultService } from './shared/system-service/defaults.services';
import { Process } from './system-files/process';
import { ComponentType } from './system-files/system.types';
import { Constants } from 'src/app/system-files/constants';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  // AppComponent is a thin shell: it registers itself as the "system" process,
  // stamps the environment default and hands its ViewContainerRef to the
  // component-reference service. The remaining services are injected purely to
  // break circular DI, so empty stubs are sufficient.
  const processIdServiceStub = {
    getNewProcessId: () => 4,
  };
  const runningProcessServiceStub = {
    addProcess: (_process: Process) => undefined,
  };
  const componentReferenceServiceStub = {
    setViewContainerRef: () => undefined,
  };
  const defaultServiceStub = {
    updateDefaultData: (_key: string, _value: string) => undefined,
    getDefaultSetting: () => Constants.EMPTY_STRING,
  };
  const swUpdateStub = {
    isEnabled: false,
    versionUpdates: new Subject<unknown>(),
    activateUpdate: () => Promise.resolve(true),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: ProcessIDService, useValue: processIdServiceStub },
        { provide: RunningProcessService, useValue: runningProcessServiceStub },
        { provide: AudioService, useValue: {} },
        { provide: ComponentReferenceService, useValue: componentReferenceServiceStub },
        { provide: FileIndexerService, useValue: {} },
        { provide: SessionManagementService, useValue: {} },
        { provide: DefaultService, useValue: defaultServiceStub },
        { provide: SwUpdate, useValue: swUpdateStub },
      ],
      // The shell template hosts <cos-poweronoff>/<cos-login>/<cos-desktop>,
      // which are declared by AppModule and out of scope for this unit test.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers itself as the system process on construction', () => {
    const addProcessSpy = jest.spyOn(runningProcessServiceStub, 'addProcess');

    // Re-create so the spy observes the constructor call.
    const freshComponent = TestBed.createComponent(AppComponent).componentInstance;

    expect(freshComponent.name).toBe('system');
    expect(freshComponent.type).toBe(ComponentType.System);
    expect(freshComponent.hasWindow).toBe(false);
    expect(addProcessSpy).toHaveBeenCalledWith(expect.any(Process));

    addProcessSpy.mockRestore();
  });

  it('stamps the NON-PROD environment default when not served from the prod endpoint', () => {
    const updateSpy = jest.spyOn(defaultServiceStub, 'updateDefaultData');

    component.ngOnInit();

    expect(updateSpy).toHaveBeenCalledWith(Constants.ENVIRONMENT, Constants.NON_PROD);
    updateSpy.mockRestore();
  });

  it('publishes its view container so processes can be rendered into it', async () => {
    const setRefSpy = jest.spyOn(componentReferenceServiceStub, 'setViewContainerRef');

    fixture.detectChanges();
    await component.ngAfterViewInit();

    expect(component.itemViewContainer).toBeTruthy();
    expect(setRefSpy).toHaveBeenCalledWith(component.itemViewContainer);
    setRefSpy.mockRestore();
  });

  it('ignores service-worker version updates while the worker is disabled', () => {
    const activateSpy = jest.spyOn(swUpdateStub, 'activateUpdate');

    swUpdateStub.versionUpdates.next({ type: 'VERSION_READY' });

    expect(activateSpy).not.toHaveBeenCalled();
    activateSpy.mockRestore();
  });
});
