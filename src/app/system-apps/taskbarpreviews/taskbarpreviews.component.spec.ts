import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskbarpreviewsComponent } from './taskbarpreviews.component';

describe('TaskbarpreviewsComponent', () => {
  let component: TaskbarpreviewsComponent;
  let fixture: ComponentFixture<TaskbarpreviewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskbarpreviewsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskbarpreviewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
