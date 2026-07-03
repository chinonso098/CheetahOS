import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhotoViewerComponent } from './photoviewer.component';

describe('PhotoViewerComponent', () => {
  let component: PhotoViewerComponent;
  let fixture: ComponentFixture<PhotoViewerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PhotoViewerComponent]
    });
    fixture = TestBed.createComponent(PhotoViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
