import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarkDownViewerComponent } from './markdownviewer.component';

describe('MarkDownViewerComponent', () => {
  let component: MarkDownViewerComponent;
  let fixture: ComponentFixture<MarkDownViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkDownViewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarkDownViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
