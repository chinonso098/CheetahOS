import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { SystemtrayComponent } from './systemtray.component';
import { AudioService } from 'src/app/shared/system-service/audio.services';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { Constants } from 'src/app/system-files/constants';

describe('SystemtrayComponent', () => {
  let component: SystemtrayComponent;
  let fixture: ComponentFixture<SystemtrayComponent>;
  let menuService: MenuService;

  let volume = 0.5;
  const audioServiceStub = {
    changeVolumeNotify: new Subject<void>(),
    showVolumeControlNotify: new Subject<void>(),
    hideVolumeControlNotify: new Subject<string>(),
    getVolume: () => volume,
  };

  beforeEach(async () => {
    volume = 0.5;

    await TestBed.configureTestingModule({
      declarations: [SystemtrayComponent],
      providers: [{ provide: AudioService, useValue: audioServiceStub }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);

    fixture = TestBed.createComponent(SystemtrayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the clock in 12-hour form and the date as M/D/YYYY', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 2, 9, 13, 5));

    component.updateTime();
    component.getDate();

    expect(component.subscribeTime).toBe('1:05 PM');
    expect(component.subscribeDate).toBe('3/9/2024');
    jest.useRealTimers();
  });

  it('picks the volume icon and tooltip from the current audio level', async () => {
    // setVolumeIcon only runs when the taskbar volume figure is in the DOM.
    const tskBarVolumeElmnt = document.createElement('img');
    tskBarVolumeElmnt.id = 'taskBarVolumeFig';
    document.body.appendChild(tskBarVolumeElmnt);

    volume = 0.85;
    await component.updateVolume();
    expect(component.audioIcon).toBe(`${Constants.IMAGE_BASE_PATH}high_volume.png`);
    expect(component.currentVolumeTxt).toBe('Speaker: 85%');

    volume = 0;
    await component.updateVolume();
    expect(component.audioIcon).toBe(`${Constants.IMAGE_BASE_PATH}no_volume.png`);

    tskBarVolumeElmnt.remove();
  });

  it('toggles the volume flyout and closes it when another owner claims it', () => {
    let shown = 0;
    audioServiceStub.showVolumeControlNotify.subscribe(() => shown++);

    component.showVolumeControl();
    expect(component.isShowVolumeControl).toBe(true);
    expect(shown).toBe(1);

    component.showVolumeControl();
    expect(component.isShowVolumeControl).toBe(false);

    component.showVolumeControl();
    audioServiceStub.hideVolumeControlNotify.next(Constants.EMPTY_STRING);
    expect(component.isShowVolumeControl).toBe(false);
  });

  it('toggles the overflow pane and closes it when the menu service asks', () => {
    let shown = 0;
    menuService.showOverFlowMenu.subscribe(() => shown++);

    component.showOverFlowMenuPane();
    expect(component.isShowOverFlowMenuPane).toBe(true);
    expect(shown).toBe(1);

    menuService.hideOverFlowMenu.next(Constants.EMPTY_STRING);
    expect(component.isShowOverFlowMenuPane).toBe(false);
  });
});
