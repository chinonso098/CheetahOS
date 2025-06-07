import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BasicWindowComponent } from './basicwindow.component';

describe('BasicwindowComponent', () => {
  let component: BasicWindowComponent;
  let fixture: ComponentFixture<BasicWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BasicWindowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BasicWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
