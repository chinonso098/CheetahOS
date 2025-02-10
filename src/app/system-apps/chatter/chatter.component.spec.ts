import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatterComponent } from './chatter.component';

describe('ChatterComponent', () => {
  let component: ChatterComponent;
  let fixture: ComponentFixture<ChatterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
