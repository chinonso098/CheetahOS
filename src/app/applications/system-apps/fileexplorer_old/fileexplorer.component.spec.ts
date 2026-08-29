import { ElementRef, QueryList } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { readFileSync } from 'fs';

import { FileExplorerComponent } from './fileexplorer.component';
import { FileExplorerContextMenuHelper } from './fileexplorer.context.menu.helper';
import { createFileExplorerTestDoubles } from '../fileexplorer.test-doubles';

import { Constants } from 'src/app/system-files/constants';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { GeneralMenu } from 'src/app/shared/system-ui-components/menu/menu.types';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** FileInfo exposes its data through getters, which are plain properties at runtime. */
const makeFile = (fileName:string, currentPath:string, isFile = true, extras:Record<string, unknown> = {}):FileInfo =>
  ({
    getFileName: fileName,
    getFileNameWithExtension: fileName,
    getCurrentPath: currentPath,
    getContentPath: Constants.EMPTY_STRING,
    getIsFile: isFile,
    getIsShortCut: false,
    getIsHidden: false,
    getFileExtension: Constants.EMPTY_STRING,
    getFileType: Constants.EMPTY_STRING,
    getSize: 0,
    getFileSizeUnit: 'KB',
    ...extras,
  } as unknown as FileInfo);

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

const menuRow = (label:string):GeneralMenu => ({ icon:Constants.EMPTY_STRING, label, action: () => undefined });

describe('FileExplorerComponent (fileexplorer_old)', () => {
  let component:FileExplorerComponent;

  let fileService:any;
  let systemNotificationService:any;
  let userNotificationService:any;
  let themeChange$:Subject<string>;
  let themeService:any;

  beforeEach(async () => {
    const doubles = createFileExplorerTestDoubles();
    fileService = doubles.fileService;
    systemNotificationService = doubles.systemNotificationService;
    userNotificationService = doubles.userNotificationService;
    themeService = doubles.themeService;
    themeChange$ = doubles.themeChange$;

    await TestBed.configureTestingModule({
      declarations: [FileExplorerComponent],
      providers: doubles.providers,
    })
      // The real template pulls in the window shell, menus, the file tree and
      // several pipes/directives. These specs exercise component logic; the one
      // template concern that matters is asserted from source instead.
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
  });

  //#region Item 1 — lasso + multi-delete coupling
  describe('lasso selection', () => {
    beforeEach(() => {
      component.fileExplorerBoundedRect = rectOf(0, 0, 500, 500);
      // Three icons in a row, 100px apart.
      component.iconBtnRefs = queryListOf([
        btnAt(0, 0, 50, 50),
        btnAt(100, 0, 150, 50),
        btnAt(200, 0, 250, 50),
      ]);
    });

    it('marks only the icons the rectangle intersects', () => {
      component.highlightSelectedItems(0, 0, 160, 60);

      expect(Array.from(component.markedBtnIds).sort()).toEqual([0, 1]);
    });

    it('de-selects an icon once the rectangle no longer covers it', () => {
      component.highlightSelectedItems(0, 0, 160, 60);
      expect(component.markedBtnIds.has(1)).toBe(true);

      component.highlightSelectedItems(0, 0, 60, 60);

      expect(Array.from(component.markedBtnIds)).toEqual([0]);
    });

    it('keys marks by QueryList order so ids line up with fetchedFiles', () => {
      component.fetchedFiles = [
        makeFile('a.txt', '/Users/a.txt'),
        makeFile('b.txt', '/Users/b.txt'),
        makeFile('c.txt', '/Users/c.txt'),
      ];

      component.highlightSelectedItems(200, 0, 60, 60);

      const marked = Array.from(component.markedBtnIds).map(i => component.fetchedFiles[i].getFileName);
      expect(marked).toEqual(['c.txt']);
    });

    it('does not scan the document, so a foreign window cannot be selected', () => {
      // The previous implementation queried document for '.iconview-button' and
      // derived the index by stripping 'btnElmnt-{pid}-' off the id. An element
      // without an id left an empty string, and Number('') is 0 — so a stray
      // button anywhere in the document marked THIS window's index 0.
      const foreign = document.createElement('div');
      foreign.className = 'iconview-button';
      // jsdom zeroes every rect, so the foreign node is given one that overlaps
      // the lasso — otherwise the hit test rejects it for the wrong reason.
      foreign.getBoundingClientRect = () => rectOf(0, 0, 10, 10);
      document.body.appendChild(foreign);

      // None of this window's own icons reach the origin.
      component.iconBtnRefs = queryListOf([
        btnAt(100, 100, 150, 150),
        btnAt(200, 100, 250, 150),
      ]);

      component.highlightSelectedItems(0, 0, 10, 10);

      expect(component.markedBtnIds.size).toBe(0);
      document.body.removeChild(foreign);
    });

    it('is a no-op before the view initialises the QueryList', () => {
      component.iconBtnRefs = undefined as unknown as QueryList<ElementRef<HTMLElement>>;

      expect(() => component.highlightSelectedItems(0, 0, 100, 100)).not.toThrow();
      expect(component.markedBtnIds.size).toBe(0);
    });

    it('promotes the marked set to a multi-selection on mouse-up', () => {
      jest.spyOn(component, 'getSelectFileSizeSumAndUnit').mockImplementation(() => undefined);

      component.markedBtnIds.add(0);
      component.markedBtnIds.add(1);
      component.deActivateMultiSelect();

      expect(component.areMultipleIconsHighlighted).toBe(true);
      expect(component.lassoVisible).toBe(false);
    });

    it('does not claim a multi-selection when the lasso caught nothing', () => {
      jest.spyOn(component, 'getSelectFileSizeSumAndUnit').mockImplementation(() => undefined);

      component.deActivateMultiSelect();

      expect(component.areMultipleIconsHighlighted).toBe(false);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      component.fetchedFiles = [
        makeFile('a.txt', '/Users/a.txt'),
        makeFile('b.txt', '/Users/b.txt'),
        makeFile('c.txt', '/Users/c.txt'),
      ];
    });

    it('deletes every lassoed file, confirming only once for the batch', async () => {
      component.markedBtnIds = new Set([0, 2]);
      component.areMultipleIconsHighlighted = true;

      await component.onDeleteFile();

      expect(fileService.deleteAsync).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = fileService.deleteAsync.mock.calls;
      expect(firstCall[0]).toBe('/Users/a.txt');
      expect(firstCall[3].skipConfirmDialog).toBe(false);
      expect(secondCall[0]).toBe('/Users/c.txt');
      expect(secondCall[3].skipConfirmDialog).toBe(true);
    });

    it('removes exactly the deleted rows and clears the selection', async () => {
      component.markedBtnIds = new Set([0, 2]);
      component.areMultipleIconsHighlighted = true;

      await component.onDeleteFile();

      expect(component.fetchedFiles.map(f => f.getFileName)).toEqual(['b.txt']);
      expect(component.markedBtnIds.size).toBe(0);
      expect(component.areMultipleIconsHighlighted).toBe(false);
    });

    it('falls back to the single selected file when no lasso selection is active', async () => {
      component.areMultipleIconsHighlighted = false;
      component['selectedFile'] = component.fetchedFiles[1];

      await component.onDeleteFile();

      expect(fileService.deleteAsync).toHaveBeenCalledTimes(1);
      expect(fileService.deleteAsync.mock.calls[0][0]).toBe('/Users/b.txt');
      expect(component.fetchedFiles.map(f => f.getFileName)).toEqual(['a.txt', 'c.txt']);
    });

    it('keeps every row when the service refuses a delete', async () => {
      fileService.deleteAsync.mockResolvedValue(false);
      component.markedBtnIds = new Set([0, 1]);
      component.areMultipleIconsHighlighted = true;

      await component.onDeleteFile();

      expect(component.fetchedFiles).toHaveLength(3);
    });

    it('ignores marked ids that no longer point at a file', async () => {
      component.markedBtnIds = new Set([0, 99]);
      component.areMultipleIconsHighlighted = true;

      await component.onDeleteFile();

      expect(fileService.deleteAsync).toHaveBeenCalledTimes(1);
      expect(component.fetchedFiles.map(f => f.getFileName)).toEqual(['b.txt', 'c.txt']);
    });

    it('matches on path as well as name when pruning rows', () => {
      component.fetchedFiles = [
        makeFile('dup.txt', '/Users/one/dup.txt'),
        makeFile('dup.txt', '/Users/two/dup.txt'),
      ];

      component.removeDeletedFiles([makeFile('dup.txt', '/Users/one/dup.txt')]);

      expect(component.fetchedFiles).toHaveLength(1);
      expect(component.fetchedFiles[0].getCurrentPath).toBe('/Users/two/dup.txt');
    });
  });

  /**
   * Guards the defect this pairing shipped with: the details-view row carried
   * #iconBtn (so the lasso marked it) but no iconStateClass binding, leaving the
   * selection invisible while delete still acted on it.
   */
  describe('template contract', () => {
    it('gives every lasso-hit-tested row a selection highlight binding', () => {
      const template = readFileSync(`${__dirname}/fileexplorer.component.html`, 'utf8');

      const rows = template.split('<').filter(chunk => chunk.includes('#iconBtn'));

      expect(rows.length).toBeGreaterThan(0);
      rows.forEach(row => expect(row).toContain("iconStateClass(i, 'primary')"));
    });
  });
  //#endregion

  //#region Item 2 — drag out
  describe('drag out', () => {
    const dragEvent = (dropEffect:'move'|'none' = 'move'):DragEvent =>
      ({
        dataTransfer: { effectAllowed:'uninitialized', dropEffect, files:[] },
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as DragEvent);

    beforeEach(() => {
      component.fetchedFiles = [
        makeFile('a.txt', '/Users/a.txt'),
        makeFile('b.txt', '/Users/b.txt'),
        makeFile('c.txt', '/Users/c.txt'),
      ];
      jest.spyOn(component, 'doBtnClickThings').mockImplementation(() => undefined);
    });

    it('drags the whole selection when the grabbed icon is part of it', () => {
      component.markedBtnIds = new Set([0, 2]);

      component.onDragStart(dragEvent(), 0);

      const queued = fileService.addDragAndDropFile.mock.calls.map((c:any[]) => c[0].getFileName);
      expect(queued.sort()).toEqual(['a.txt', 'c.txt']);
      expect(component['isDragFromFileExplorerActive']).toBe(true);
    });

    it('drags only the grabbed icon when it sits outside the selection', () => {
      component.markedBtnIds = new Set([0, 2]);

      component.onDragStart(dragEvent(), 1);

      expect(fileService.addDragAndDropFile).toHaveBeenCalledTimes(1);
      expect(fileService.addDragAndDropFile.mock.calls[0][0].getFileName).toBe('b.txt');
      expect(component.doBtnClickThings).toHaveBeenCalledWith(1);
    });

    it('cancels the drag when the index resolves to nothing', () => {
      const evt = dragEvent();

      component.onDragStart(evt, 99);

      expect(evt.preventDefault).toHaveBeenCalled();
      expect(fileService.addDragAndDropFile).not.toHaveBeenCalled();
      expect(component['isDragFromFileExplorerActive']).toBe(false);
    });

    it('publishes the drag origin so the drop target can identify it', () => {
      component.onDragStart(dragEvent(), 0);

      expect(systemNotificationService.setDropEventInfo).toHaveBeenCalledWith(
        expect.objectContaining({ origin:`${component.name}-${component.processId}`, isDragActive:true })
      );
    });

    it('clears the queued payload when the drag is abandoned', () => {
      component.onDragEnd(dragEvent('none'));

      expect(fileService.removeDragAndDropFile).toHaveBeenCalled();
      expect(systemNotificationService.removeDragEventInfo).toHaveBeenCalled();
      expect(component['isDragFromFileExplorerActive']).toBe(false);
    });

    it('leaves the payload alone when a real drop will consume it', () => {
      component.onDragEnd(dragEvent('move'));

      expect(fileService.removeDragAndDropFile).not.toHaveBeenCalled();
    });
  });

  describe('drop', () => {
    const dropEvent = ():DragEvent =>
      ({ dataTransfer:{ files:[] }, preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as DragEvent);

    beforeEach(() => {
      component.directory = '/Users/Documents';
      systemNotificationService.getDragEventInfo.mockReturnValue({ origin:'x', currentLocation:'', isDragActive:true });
      jest.spyOn(component, 'refresh').mockResolvedValue(undefined);
    });

    it('ignores files already sitting in the drop target', async () => {
      fileService.getDragAndDropFile.mockReturnValue([makeFile('a.txt', '/Users/Documents/a.txt')]);

      await component.onDrop(dropEvent());

      expect(fileService.moveAsync).not.toHaveBeenCalled();
      expect(systemNotificationService.removeDragEventInfo).toHaveBeenCalled();
    });

    it('moves only the files that come from elsewhere', async () => {
      fileService.getDragAndDropFile.mockReturnValue([
        makeFile('a.txt', '/Users/Documents/a.txt'),
        makeFile('b.txt', '/Users/Downloads/b.txt'),
      ]);

      await component.onDrop(dropEvent());

      expect(fileService.moveAsync).toHaveBeenCalledTimes(1);
      expect(fileService.moveAsync).toHaveBeenCalledWith('/Users/Downloads/b.txt', '/Users/Documents', true);
    });

    it('reports the files it could not move without hiding the ones it did', async () => {
      fileService.getDragAndDropFile.mockReturnValue([
        makeFile('good.txt', '/Users/Downloads/good.txt'),
        makeFile('bad.txt', '/Users/Downloads/bad.txt'),
      ]);
      fileService.moveAsync
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('locked'));

      await component.onDrop(dropEvent());

      expect(userNotificationService.showErrorNotification).toHaveBeenCalled();
      const [msg] = userNotificationService.showErrorNotification.mock.calls[0];
      expect(msg).toContain('bad.txt');
      expect(msg).toContain('1 of 2');
    });
  });
  //#endregion

  //#region Item 3 — address bar
  describe('onPathSubmit', () => {
    let navigateTo:jest.SpyInstance;

    beforeEach(() => {
      navigateTo = jest.spyOn(component as any, 'navigateTo').mockResolvedValue(undefined);
      component.isPathEditing = true;
    });

    it('just closes the editor on an empty entry', async () => {
      component.pathForm.setValue({ pathInput:'   ' });

      await component.onPathSubmit();

      expect(navigateTo).not.toHaveBeenCalled();
      expect(component.isPathEditing).toBe(false);
    });

    it('navigates to a folder that exists', async () => {
      fileService.getStatAsync.mockResolvedValue({ exists:true, isDirectory:true });
      component.pathForm.setValue({ pathInput:'/Users/Documents' });

      await component.onPathSubmit();

      expect(navigateTo).toHaveBeenCalledWith('/Users/Documents', 'push');
      expect(component.isPathEditing).toBe(false);
    });

    it('resolves a relative entry against root', async () => {
      fileService.getStatAsync.mockResolvedValue({ exists:true, isDirectory:true });
      component.pathForm.setValue({ pathInput:'Users/Documents' });

      await component.onPathSubmit();

      expect(fileService.getStatAsync).toHaveBeenCalledWith('/Users/Documents');
      expect(navigateTo).toHaveBeenCalledWith('/Users/Documents', 'push');
    });

    it('short-circuits root without asking the file system', async () => {
      component.pathForm.setValue({ pathInput:Constants.ROOT });

      await component.onPathSubmit();

      expect(fileService.getStatAsync).not.toHaveBeenCalled();
      expect(navigateTo).toHaveBeenCalledWith(Constants.ROOT, 'push');
    });

    it('opens the containing folder when handed a file', async () => {
      fileService.getStatAsync.mockResolvedValue({ exists:true, isDirectory:false });
      component.pathForm.setValue({ pathInput:'/Users/Documents/notes.txt' });

      await component.onPathSubmit();

      expect(navigateTo).toHaveBeenCalledWith('/Users/Documents', 'push');
    });

    it('keeps the editor open and warns when the path is unknown', async () => {
      fileService.getStatAsync.mockResolvedValue({ exists:false, isDirectory:false });
      component.pathForm.setValue({ pathInput:'/NotAFolder' });

      await component.onPathSubmit();

      expect(navigateTo).not.toHaveBeenCalled();
      expect(component.isPathEditing).toBe(true);
      const [msg, title] = userNotificationService.showErrorNotification.mock.calls[0];
      expect(msg).toContain('/NotAFolder');
      expect(title).toBe('Location not found');
    });
  });
  //#endregion

  //#region Item 4 — nav stack, theming, context menu
  describe('navigation stack', () => {
    const navigateTo = (path:string, kind:string) => (component as any).navigateTo(path, kind);

    beforeEach(() => {
      jest.spyOn(component as any, 'loadFiles').mockResolvedValue(undefined);
      jest.spyOn(component, 'generateBreadCrumbs').mockImplementation(() => undefined);
      jest.spyOn(component, 'setNavPathIcon').mockImplementation(() => undefined);
      jest.spyOn(component, 'captureComponentImg').mockResolvedValue(undefined);
      jest.spyOn(component as any, 'resetSelectionStateAfterNavigation').mockImplementation(() => undefined);
      component.directory = '/Users';
    });

    it('pushes the previous directory and enables Back', async () => {
      await navigateTo('/Users/Documents', 'push');

      expect(component.directory).toBe('/Users/Documents');
      expect(component.prevPathEntries).toEqual(['/Users']);
      expect(component.isPrevBtnActive).toBe(true);
      expect(component.isNextBtnActive).toBe(false);
    });

    it('drops the forward history once a new branch is taken', async () => {
      component.nextPathEntries = ['/Users/Pictures'];

      await navigateTo('/Users/Documents', 'push');

      expect(component.nextPathEntries).toEqual([]);
      expect(component.isNextBtnActive).toBe(false);
    });

    it('moves the current directory onto the forward stack when going back', async () => {
      await navigateTo('/Users/Documents', 'back');

      expect(component.nextPathEntries).toEqual(['/Users']);
      expect(component.isNextBtnActive).toBe(true);
    });

    it('does nothing when the target is where we already are', async () => {
      await navigateTo('/Users', 'push');

      expect(component.prevPathEntries).toEqual([]);
      expect(component.directory).toBe('/Users');
    });

    it('enables Up whenever a parent exists', async () => {
      await navigateTo('/Users/Documents', 'push');

      expect(component.isUpBtnActive).toBe(true);
    });
  });

  describe('theming', () => {
    it('adopts the theme in force when the window opens', () => {
      expect(component.isLightTheme).toBe(false);
    });

    it('follows a later theme switch', () => {
      themeService.isLightTheme.mockReturnValue(true);

      themeChange$.next(Constants.DEFAULT_THEME);

      expect(component.isLightTheme).toBe(true);
    });

    it('stops following once the window is closed', () => {
      component.ngOnDestroy();
      themeService.isLightTheme.mockReturnValue(true);

      themeChange$.next(Constants.DEFAULT_THEME);

      expect(component.isLightTheme).toBe(false);
    });
  });

  describe('context menu helper', () => {
    const sourceData:GeneralMenu[] = [
      MenuAction.OPEN, MenuAction.CUT, MenuAction.DELETE, MenuAction.RENAME,
      MenuAction.OPEN_WITH, MenuAction.EXTRACT_ALL, MenuAction.PROPERTIES,
    ].map(menuRow);

    it('withholds destructive actions on the protected library shortcuts', () => {
      const protectedShortcut = makeFile('documents.url', '/documents.url', true, { getFileExtension:Constants.URL });

      const [menu] = FileExplorerContextMenuHelper.adjustIconContextMenuData(protectedShortcut, sourceData, false);

      const labels = menu.map(m => m.label);
      expect(labels).not.toContain(MenuAction.DELETE);
      expect(labels).not.toContain(MenuAction.RENAME);
      expect(labels).not.toContain(MenuAction.CUT);
      expect(labels).toContain(MenuAction.PROPERTIES);
    });

    it('offers them on an ordinary file', () => {
      const ordinary = makeFile('notes.txt', '/Users/notes.txt', true, { getFileExtension:'.txt' });

      const [menu] = FileExplorerContextMenuHelper.adjustIconContextMenuData(ordinary, sourceData, false);

      expect(menu.map(m => m.label)).toContain(MenuAction.DELETE);
    });

    it('offers "Extract All" only on a zip', () => {
      const zip = makeFile('a.zip', '/Users/a.zip', true, { getFileExtension:'.zip' });
      const txt = makeFile('a.txt', '/Users/a.txt', true, { getFileExtension:'.txt' });

      const [zipMenu] = FileExplorerContextMenuHelper.adjustIconContextMenuData(zip, sourceData, false);
      const [txtMenu] = FileExplorerContextMenuHelper.adjustIconContextMenuData(txt, sourceData, false);

      expect(zipMenu.map(m => m.label)).toContain(MenuAction.EXTRACT_ALL);
      expect(txtMenu.map(m => m.label)).not.toContain(MenuAction.EXTRACT_ALL);
    });

    it('never offers "Open with" on a folder', () => {
      const folder = makeFile('Documents', '/Users/Documents', false);

      const [menu] = FileExplorerContextMenuHelper.adjustIconContextMenuData(folder, sourceData, false);

      expect(menu.map(m => m.label)).not.toContain(MenuAction.OPEN_WITH);
    });

    it('keeps the menu inside the window when opened near the bottom edge', () => {
      const viewport = rectOf(0, 0, 800, 600);

      const [position] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(
        viewport, { clientX:700, clientY:590 } as MouseEvent, 300);

      expect(position.xAxis).toBeGreaterThanOrEqual(0);
      expect(position.yAxis).toBeGreaterThanOrEqual(0);
      expect(position.yAxis).toBeLessThan(590);
    });

    it('flips the submenu left only when it would overflow the right edge', () => {
      const viewport = rectOf(0, 0, 800, 600);

      const [, flippedNearEdge] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(
        viewport, { clientX:780, clientY:100 } as MouseEvent, 300);
      const [, notFlipped] = FileExplorerContextMenuHelper.checkAndHandleMenuBounds(
        viewport, { clientX:100, clientY:100 } as MouseEvent, 300);

      expect(flippedNearEdge).toBe(true);
      expect(notFlipped).toBe(false);
    });
  });
  //#endregion
});
