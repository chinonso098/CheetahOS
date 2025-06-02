import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WarpingstarfieldComponent } from './warpingstarfield.component';

describe('WarpingstarfieldComponent', () => {
  let component: WarpingstarfieldComponent;
  let fixture: ComponentFixture<WarpingstarfieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WarpingstarfieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WarpingstarfieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
