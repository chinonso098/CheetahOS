import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartMenuComponent } from './startmenu.component';

describe('StartButtonComponent', () => {
  let component: StartMenuComponent;
  let fixture: ComponentFixture<StartMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StartMenuComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
