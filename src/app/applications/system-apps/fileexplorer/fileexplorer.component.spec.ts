import { ElementRef, QueryList } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { FileExplorerComponent } from './fileexplorer.component';
import { FileExplorerPathHelper } from './fileexplorer.path.helper';
import { createFileExplorerTestDoubles, FileExplorerTestDoubles } from '../fileexplorer.test-doubles';
import { ViewOptions, ViewOptionsCSS } from './fileexplorer.types';
import { WindowService } from 'src/app/shared/system-service/window.service';

import { Constants } from 'src/app/system-files/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

const rectOf = (left:number, top:number, right:number, bottom:number):DOMRect =>
  ({ left, top, right, bottom, x:left, y:top, width:right - left, height:bottom - top, toJSON(){/* noop */} } as DOMRect);

/** An element whose only job is to report a fixed geometry to the hit test. */
const btnAt = (left:number, top:number, right:number, bottom:number):ElementRef<HTMLElement> =>
  new ElementRef({ getBoundingClientRect: () => rectOf(left, top, right, bottom) } as unknown as HTMLElement);

const queryListOf = (refs:ElementRef<HTMLElement>[]):QueryList<ElementRef<HTMLElement>> => {
  const ql = new QueryList<ElementRef<HTMLElement>>();
  ql.reset(refs);
  return ql;
};

describe('FileExplorerComponent', () => {
  let component:FileExplorerComponent;
  let doubles:FileExplorerTestDoubles;

  beforeEach(async () => {
    doubles = createFileExplorerTestDoubles();

    await TestBed.configureTestingModule({
      declarations: [FileExplorerComponent],
      providers: [
        ...doubles.providers,
        // focusWindow() (called when the address bar opens) also asks whether
        // the window already has focus, which the shared double omits.
        {
          provide: WindowService,
          useValue: {
            focusOnCurrentProcessWindowNotify: new Subject<number>(),
            getProcessWindowIDWithHighestZIndex: () => 1,
            getIsWindowInFocus: () => false,
          },
        },
      ],
    })
      // The real template pulls in the window shell, menus, the file tree and
      // several pipes/directives; these specs exercise component logic only.
      .overrideComponent(FileExplorerComponent, { set: { template: '<div></div>' } })
      .compileComponents();

    component = TestBed.createComponent(FileExplorerComponent).componentInstance;

    // ngOnInit bails out before building the forms when no FileInfo was seeded.
    const fb = TestBed.inject(FormBuilder);
    component.pathForm = fb.nonNullable.group({ pathInput: Constants.EMPTY_STRING });
    component.renameForm = fb.nonNullable.group({ renameInput: Constants.EMPTY_STRING });
    component.searchForm = fb.nonNullable.group({ searchInput: Constants.EMPTY_STRING });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.name).toBe('fileexplorer');
  });

  it('marks only the icons the lasso rectangle intersects', () => {
    component.fileExplorerBoundedRect = rectOf(0, 0, 500, 500);
    // Three icons in a row, 100px apart.
    component.iconBtnRefs = queryListOf([
      btnAt(0, 0, 50, 50),
      btnAt(100, 0, 150, 50),
      btnAt(200, 0, 250, 50),
    ]);

    component.highlightSelectedItems(0, 0, 160, 60);
    expect(Array.from(component.markedBtnIds).sort()).toEqual([0, 1]);
    expect(component.getCountOfAllTheMarkedButtons()).toBe(2);

    // Shrinking the rectangle de-selects the icon it no longer covers.
    component.highlightSelectedItems(0, 0, 60, 60);
    expect(Array.from(component.markedBtnIds)).toEqual([0]);
  });

  it('swaps the layout classes when the view option changes', () => {
    component.toggleDetailsView();
    expect(component.currentViewOption).toBe(ViewOptions.DETAILS_VIEW);
    expect(component.olClassName).toBe(ViewOptionsCSS.DETAILS_VIEW_CSS);
    expect(component.viewSizeClass).toBe('view-details');

    component.toggleLargeIconsView();
    expect(component.currentViewOption).toBe(ViewOptions.LARGE_ICON_VIEW);
    expect(component.olClassName).toBe(ViewOptionsCSS.ICONS_VIEW_CSS);
    expect(component.viewSizeClass).toBe('view-large');
  });

  it('opens the address bar seeded with the current directory and closes again', () => {
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.directory = '/Users/Documents';

    component.showPathTextBox(evt);

    expect(evt.stopPropagation).toHaveBeenCalled();
    expect(component.isPathEditing).toBe(true);
    expect(component.pathForm.value.pathInput).toBe('/Users/Documents');

    component.hidePathTextBox();
    expect(component.isPathEditing).toBe(false);
  });

  it('reverts to the breadcrumbs without navigating when the address bar is empty', async () => {
    component.isPathEditing = true;
    component.pathForm.setValue({ pathInput: '   ' });

    await component.onPathSubmit();

    expect(component.isPathEditing).toBe(false);
    expect(component.directory).not.toBe('   ');
  });

  describe('display full path in title bar', () => {
    const labels = {
      root: Constants.ROOT,
      thisPc: Constants.THISPC,
      recycleBinPath: Constants.RECYCLE_BIN_PATH,
      recycleBin: Constants.RECYCLE_BIN,
      userBasePath: Constants.USER_BASE_PATH,
      osDisk: Constants.OSDISK,
      empty: Constants.EMPTY_STRING,
    };

    it('spells out every segment when the setting is on', () => {
      expect(FileExplorerPathHelper.buildBreadCrumbs('/Users/Documents', labels, true))
        .toEqual([Constants.THISPC, 'Users', 'Documents']);
    });

    it('collapses to the current folder when the setting is off', () => {
      expect(FileExplorerPathHelper.buildBreadCrumbs('/Users/Documents', labels, false))
        .toEqual(['Documents']);
    });

    it('hands the setting to the path helper when rebuilding the trail', () => {
      component.directory = '/Users/Documents';

      component.displayFullPathInTitleBar = true;
      component.generateBreadCrumbs();
      expect(component._directoryTraversalList).toEqual([Constants.THISPC, 'Users', 'Documents']);

      component.displayFullPathInTitleBar = false;
      component.generateBreadCrumbs();
      expect(component._directoryTraversalList).toEqual(['Documents']);
    });

    it('rebuilds the trail as soon as Folder Options changes the setting', () => {
      component.directory = '/Users/Documents';
      component.displayFullPathInTitleBar = false;
      component.generateBreadCrumbs();

      doubles.defaultService.getDefaultSetting.mockReturnValue(Constants.TRUE);
      doubles.defaultService.defaultSettingsChangeNotify.next(Constants.DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR);

      expect(component.displayFullPathInTitleBar).toBe(true);
      expect(component._directoryTraversalList).toEqual([Constants.THISPC, 'Users', 'Documents']);
    });
  });
});
