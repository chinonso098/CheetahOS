import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';

import { SearchComponent } from './search.component';
import { FileIndexerService } from 'src/app/shared/system-service/file.indexer.services';
import { ActivityHistoryService } from 'src/app/shared/system-service/activity.tracking.service';
import { ProcessHandlerService } from 'src/app/shared/system-service/process.handler.service';
import { MenuService } from 'src/app/shared/system-service/menu.services';
import { FileSearchIndex } from 'src/app/system-files/commons/common.interfaces';
import { MenuAction } from 'src/app/shared/system-ui-components/menu/menu.enums';

describe('SearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;
  let menuService: MenuService;

  const indexEntry = (name: string, srcPath: string): FileSearchIndex => ({
    type: 'FILE',
    name,
    srcPath,
    opensWith: 'texteditor',
    iconPath: 'osdrive/Cheetah/System/Imageres/texteditor.png',
    contentPath: srcPath,
    dateModified: new Date('1970-01-01'),
  });

  const fileIndexerServiceStub = {
    fileIndexChangeOperation: new Subject<void>(),
    IndexingInProgress: new Subject<boolean>(),
    getFileIndex: () => [indexEntry('notes.txt', '/Users/Documents/notes.txt')],
  };
  const activityHistoryServiceStub = {
    getActivitesHistory: () => [],
    getActivityHistory: () => undefined,
  };
  const processHandlerServiceStub = { runApplication: jest.fn() };

  beforeEach(async () => {
    processHandlerServiceStub.runApplication.mockClear();

    await TestBed.configureTestingModule({
      declarations: [SearchComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: FileIndexerService, useValue: fileIndexerServiceStub },
        { provide: ActivityHistoryService, useValue: activityHistoryServiceStub },
        { provide: ProcessHandlerService, useValue: processHandlerServiceStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    menuService = TestBed.inject(MenuService);

    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => component.ngOnDestroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers a filter for every searchable category', () => {
    component.ngOnInit();

    const labels = component.menuOptions.map(([, label]) => label);
    expect(labels).toEqual(['All', 'Apps', 'Documents', 'Folders', 'Music', 'Photos', 'Videos']);
  });

  it('ranks a prefix match above a mid-name match', () => {
    const prefixHit = indexEntry('report.txt', '/Users/Documents/report.txt');
    const midHit = indexEntry('quarterly-report.txt', '/Users/Documents/quarterly-report.txt');

    expect(component.matchQualityScore(prefixHit, 'report'))
      .toBeGreaterThan(component.matchQualityScore(midHit, 'report'));
    expect(component.matchQualityScore(prefixHit, 'zzz')).toBe(0);
  });

  it('favours well-known folders and preferred file extensions', () => {
    expect(component.folderPriority('/Users/Documents/notes.txt'))
      .toBeGreaterThan(component.folderPriority('/Program-Files/simple.txt'));
    expect(component.extensionPriority('song.mp3'))
      .toBeGreaterThan(component.extensionPriority('archive.zip'));
    expect(component.removeExt('notes.txt')).toBe('notes');
  });

  it('stages a result path on the clipboard when copy path is chosen', () => {
    const file = indexEntry('notes.txt', '/Users/Documents/notes.txt');
    const evt = { stopPropagation: jest.fn() } as unknown as MouseEvent;

    component.copyPath(file, evt);

    expect(evt.stopPropagation).toHaveBeenCalled();
    expect(menuService.getStoreData()).toEqual([file.srcPath, MenuAction.COPY]);
  });
});
