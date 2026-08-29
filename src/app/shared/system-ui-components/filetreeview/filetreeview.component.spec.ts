import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';

import { FileTreeViewComponent } from './filetreeview.component';
import { FileService } from '../../system-service/file.service';
import { AudioService } from '../../system-service/audio.services';
import { MenuService } from '../../system-service/menu.services';
import { ProcessHandlerService } from '../../system-service/process.handler.service';
import { FileTreeNode } from 'src/app/system-files/commons/common.interfaces';
import { FileInfo } from 'src/app/system-files/fs/file.info';
import { Constants } from 'src/app/system-files/constants';

describe('FileTreeViewComponent', () => {
  let component: FileTreeViewComponent;
  let fixture: ComponentFixture<FileTreeViewComponent>;

  const TREE_PID = 12;

  const fileServiceStub = {
    goToDirectoryNotify: new Subject<string[]>(),
    addEventOriginator: (_uId: string) => undefined,
  };
  const menuServiceStub = {
    closeContextMenu: new Subject<string>(),
    showPropertiesView: new Subject<FileInfo>(),
    openContextMenu: (_uId: string) => undefined,
  };
  const processHandlerServiceStub = {
    runApplication: (_file: FileInfo) => undefined,
  };

  const documentsNode: FileTreeNode = {
    name: 'Documents',
    path: '/Users/Documents',
    isFolder: true,
    children: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileTreeViewComponent],
      providers: [
        { provide: FileService, useValue: fileServiceStub },
        { provide: AudioService, useValue: { play: () => Promise.resolve() } },
        { provide: MenuService, useValue: menuServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
      ],
      // The tree recurses through <cos-filetreeview> and renders <cos-menu>.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FileTreeViewComponent);
    component = fixture.componentInstance;
    component.pId = TREE_PID;
    component.ngOnChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('derives the child level and process id from its inputs', () => {
    component.level = 2;
    component.levelSrcId = 'src-1';
    component.ngOnChanges();

    expect(component.processId).toBe(TREE_PID);
    expect(component.nextLevel).toBe(3);
    expect(component.nextLevelSrcId).toBe('src-1');
  });

  it('announces the navigation target and tags itself as the event originator', async () => {
    const originatorSpy = jest.spyOn(fileServiceStub, 'addEventOriginator');
    const navigations: string[][] = [];
    fileServiceStub.goToDirectoryNotify.subscribe((n) => navigations.push(n));
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    await component.navigateToSelectedPath(evt, documentsNode.name, documentsNode.path);

    expect(evt.stopPropagation).toHaveBeenCalled();
    expect(originatorSpy).toHaveBeenCalledWith(`filetreeview-1-${TREE_PID}`);
    expect(navigations).toEqual([[documentsNode.name, documentsNode.path]]);
    originatorSpy.mockRestore();
  });

  it('opens its context menu at the cursor and claims menu ownership', () => {
    const openSpy = jest.spyOn(menuServiceStub, 'openContextMenu');
    const evt = {
      clientX: 300,
      clientY: 200,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as MouseEvent;

    component.onFileTreeContextMenu(evt, documentsNode);

    expect(component.showIconCntxtMenu).toBe(true);
    expect(component.selectedFileTreeNode).toBe(documentsNode);
    expect(component.fileExplrTreeCntxtMenuStyle['left']).toBe('210px');
    expect(component.fileExplrTreeCntxtMenuStyle['top']).toBe('110px');
    expect(openSpy).toHaveBeenCalledWith(`filetreeview-${TREE_PID}`);

    // A close notification aimed at this tree dismisses the menu.
    component.ngOnInit();
    menuServiceStub.closeContextMenu.next(`filetreeview-${TREE_PID}`);
    expect(component.showIconCntxtMenu).toBe(false);

    openSpy.mockRestore();
  });

  it('resolves the well-known user folder icons and falls back to the generic folder icon', () => {
    expect(component.getIconPath('Documents', '/Users/Documents'))
        .toBe(`${Constants.IMAGE_BASE_PATH}documents_folder_small.png`);
    expect(component.getIconPath(Constants.OSDISK, Constants.ROOT))
        .toBe(`${Constants.IMAGE_BASE_PATH}os_disk.png`);
    // Right name, wrong path -> not a special folder.
    expect(component.getIconPath('Documents', '/Users/Desktop/Documents'))
        .toBe(`${Constants.IMAGE_BASE_PATH}folder_folder_small.png`);
  });
});
