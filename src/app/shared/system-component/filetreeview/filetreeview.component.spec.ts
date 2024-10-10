import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileTreeViewComponent } from './filetreeview.component';

describe('FiletreeviewComponent', () => {
  let component: FileTreeViewComponent;
  let fixture: ComponentFixture<FileTreeViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTreeViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileTreeViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
