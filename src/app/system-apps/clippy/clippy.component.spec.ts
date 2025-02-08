import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClippyComponent } from './clippy.component';

describe('ClippyComponent', () => {
  let component: ClippyComponent;
  let fixture: ComponentFixture<ClippyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClippyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClippyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
