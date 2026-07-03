import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskBarPreviewComponent } from './taskbarpreview.component';

describe('TaskBarPreviewComponent', () => {
  let component: TaskBarPreviewComponent;
  let fixture: ComponentFixture<TaskBarPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskBarPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskBarPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
