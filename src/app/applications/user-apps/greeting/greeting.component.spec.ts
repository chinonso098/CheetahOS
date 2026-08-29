import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { GreetingComponent } from './greeting.component';
import { ComponentType } from 'src/app/system-files/system.types';
import { Constants } from 'src/app/system-files/constants';

describe('GreetingComponent', () => {
  let component: GreetingComponent;
  let fixture: ComponentFixture<GreetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GreetingComponent],
      // The template hosts <cos-primarywindow>.
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GreetingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('registers itself as a windowed user application', () => {
    expect(component.name).toBe('greeting');
    expect(component.hasWindow).toBe(true);
    expect(component.type).toBe(ComponentType.User);
    expect(component.priorUId).toBe(Constants.EMPTY_STRING);
  });
});
