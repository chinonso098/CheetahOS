import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { LoginComponent } from './login.component';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { DefaultService } from 'src/app/shared/system-service/defaults.services';
import { Constants } from 'src/app/system-files/constants';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let defaultService: DefaultService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule],
      providers: [
        // Both are heavyweight (BrowserFS bootstrap / Howler) and unused by the
        // lock-screen state transitions under test.
        { provide: ProcessHandlerService, useValue: {} },
        { provide: AudioService, useValue: { play: () => Promise.resolve() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    defaultService = TestBed.inject(DefaultService);

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    // Builds the reactive form + power menu without running the full ngOnInit
    // lock-screen/desktop transition.
    component.thingsToDoFirstOnInit();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts on the date/time view and offers shut down + restart from the power menu', () => {
    expect(component.viewOptions).toBe(component.currentDateTime);
    expect(component.isScreenLocked).toBe(true);
    expect(component.menuData.map((m) => m.label)).toEqual(['Shut down', 'Restart']);
  });

  it('swaps to the authentication form on a space keypress or a lock-screen click', () => {
    component.onKeyDown({ key: Constants.BLANK_SPACE } as KeyboardEvent);
    expect(component.viewOptions).toBe(component.authForm);

    component.showDateTime();
    expect(component.viewOptions).toBe(component.currentDateTime);

    component.showPowerMenu = true;
    component.onLockScreenViewClick();
    expect(component.viewOptions).toBe(component.authForm);
    expect(component.showPowerMenu).toBe(false);
  });

  it('resets the auth form back to the password prompt after a failed attempt', () => {
    component.showPasswordEntry = false;
    component.showLoading = true;
    component.showFailedEntry = true;

    component.onBtnClick();

    expect(component.showUserInfo).toBe(true);
    expect(component.showPasswordEntry).toBe(true);
    expect(component.showLoading).toBe(false);
    expect(component.showFailedEntry).toBe(false);
  });

  it('records the signed-in identity as Guest the first time the guest password is used', () => {
    const updateSpy = jest.spyOn(defaultService, 'updateDefaultData');
    jest.spyOn(defaultService, 'getDefaultSetting').mockReturnValue(Constants.UNKNOWN);
    component.loginForm.controls[component.formCntrlName]
        .setValue(Constants.USER_GUEST_PASSWORD);

    component.doVeryBasicAccountThings();

    expect(component.accountName).toBe(component.guestName);
    expect(component.accountIcon).toBe(component.userIcon);
    expect(updateSpy)
        .toHaveBeenCalledWith(Constants.DEFAULT_WHO_IS_THIS, Constants.USER_GUEST, false);

    jest.restoreAllMocks();
  });
});
