import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { PowerOnOffComponent } from './poweronoff.component';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { SessionManagementService } from 'src/app/shared/system-service/session.management.service';
import { Constants } from 'src/app/system-files/constants';

describe('PowerOnOffComponent', () => {
  let component: PowerOnOffComponent;
  let fixture: ComponentFixture<PowerOnOffComponent>;
  let sessionManagementService: SessionManagementService;

  const audioServiceStub = { play: () => Promise.resolve() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PowerOnOffComponent],
      providers: [{ provide: AudioService, useValue: audioServiceStub }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    sessionManagementService = TestBed.inject(SessionManagementService);
    sessionManagementService.removeSession(Constants.CHEETAH_PWR_KEY);

    fixture = TestBed.createComponent(PowerOnOffComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    component.ngOnDestroy();
    sessionManagementService.removeSession(Constants.CHEETAH_PWR_KEY);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts off with the power button showing and the system unpowered', () => {
    expect(component.showPowerBtn).toBe(true);
    expect(component.isSystemPowered).toBe(false);
    expect(component.loadingMessage).toBe('Pwr On');
  });

  it('persists the on state and begins the start-up sequence on power on', () => {
    component.powerOnSystem();

    expect(component.showPowerBtn).toBe(false);
    expect(component.isSystemPowered).toBe(true);
    expect(component.showStartUpGif).toBe(true);
    expect(component.loadingMessage).toBe('Powering On');
    expect(sessionManagementService.getSession(Constants.CHEETAH_PWR_KEY)).toBe(Constants.SYSTEM_ON);
  });

  it('cycles through the start-up messages before revealing the lock screen', () => {
    jest.useFakeTimers();
    const messageDelayMs = 1200;

    component.powerOnSystem();
    jest.advanceTimersByTime(messageDelayMs);
    expect(component.loadingMessage).toBe(component.startUpMessages[0]);

    jest.advanceTimersByTime(messageDelayMs * component.startUpMessages.length);
    // The ticker hands off to showLockScreen(), which reverts to the idle view.
    expect(component.showStartUpGif).toBe(false);
    jest.useRealTimers();
  });

  it('restores a previously powered-on session and skips the start-up chime', () => {
    sessionManagementService.addSession(Constants.CHEETAH_PWR_KEY, Constants.SYSTEM_ON);

    component.retrievePastSessionData();

    expect(component.isSystemPowered).toBe(true);
    expect(component.isFirstPwrOn).toBe(false);
  });
});
