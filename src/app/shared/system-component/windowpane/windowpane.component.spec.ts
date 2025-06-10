import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WindowpaneComponent } from './windowpane.component';

describe('WindowpaneComponent', () => {
  let component: WindowpaneComponent;
  let fixture: ComponentFixture<WindowpaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WindowpaneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WindowpaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
