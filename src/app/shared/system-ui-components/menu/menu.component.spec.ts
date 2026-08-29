import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { MenuComponent } from './menu.component';
import { MenuService } from '../../system-service/menu.services';
import { ThemeService } from '../../system-theme/theme';
import { DefaultService } from '../../system-service/defaults.services';
import { MenuAction } from './menu.enums';
import { Constants } from 'src/app/system-files/constants';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;

  const settings = new Map<string, string>();

  const menuServiceStub = {
    getPasteState: () => true,
    closeAllContextMenus: () => undefined,
  };
  const themeServiceStub = {
    themeChange: new Subject<unknown>(),
    isLightTheme: () => true,
  };
  const defaultServiceStub = {
    defaultSettingsChangeNotify: new Subject<string>(),
    getDefaultSetting: (key: string) => settings.get(key) ?? Constants.FALSE,
  };

  beforeEach(async () => {
    settings.clear();

    await TestBed.configureTestingModule({
      declarations: [MenuComponent],
      providers: [
        { provide: MenuService, useValue: menuServiceStub },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: DefaultService, useValue: defaultServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('snapshots the clipboard paste state at construction time', () => {
    expect(component.isPasteActive).toBe(true);

    const emptyClipboardSpy = jest.spyOn(menuServiceStub, 'getPasteState').mockReturnValue(false);
    expect(TestBed.createComponent(MenuComponent).componentInstance.isPasteActive).toBe(false);

    emptyClipboardSpy.mockRestore();
  });

  it('maps menu labels to their inline glyph keys', () => {
    expect(component.glyphFor(MenuAction.CUT)).toBe('cut');
    expect(component.glyphFor(MenuAction.PIN_TO_START)).toBe('pin');
    expect(component.glyphFor(MenuAction.CLOSE_ALL_WINDOWS)).toBe('close');
    expect(component.glyphFor('No such menu item')).toBe(Constants.EMPTY_STRING);
  });

  it('runs the clicked action and dismisses every variant except the checkable menu', () => {
    const closeSpy = jest.spyOn(menuServiceStub, 'closeAllContextMenus');
    const action = jest.fn();
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.onMenuItemClick(action, evt);
    expect(action).toHaveBeenCalledWith(evt);
    expect(evt.stopPropagation).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    component.menuType = component.checkableMenuOption;
    component.onMenuItemClick(action, evt);
    expect(action).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(1);

    closeSpy.mockRestore();
  });

  it('re-reads the accent and transparency surface toggles when the defaults change', () => {
    fixture.detectChanges();
    expect(component.isAccentOnTaskbar).toBe(false);
    expect(component.isOtherMenuTransparent).toBe(false);

    settings.set(Constants.DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR, Constants.TRUE);
    settings.set(Constants.DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU, Constants.TRUE);
    defaultServiceStub.defaultSettingsChangeNotify.next(Constants.DEFAULT_ACCENT_COLOR);

    expect(component.isAccentOnTaskbar).toBe(true);
    expect(component.isOtherMenuTransparent).toBe(true);
  });
});
