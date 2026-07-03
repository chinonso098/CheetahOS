import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodeEditorComponent } from './codeeditor.component';

describe('CodeEditorComponent', () => {
  let component: CodeEditorComponent;
  let fixture: ComponentFixture<CodeEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CodeEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
