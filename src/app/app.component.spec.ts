import {TestBed} from '@angular/core/testing';
import {AppComponent} from './app.component';
import {TitleComponent } from './user-apps/title/title.component';
import {DesktopComponent} from './system-apps/desktop/desktop.component';
import {WindowComponent} from './shared/system-component/window/window.component'

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        AppComponent,
        DesktopComponent,
        WindowComponent,
        TitleComponent
      ],
    }).compileComponents();
  });

  // it('should create the app', () => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   const app = fixture.componentInstance;
  //   expect(app).toBeTruthy();
  // });

  // it(`should have as title 'CheetahOs'`, () => {
  //   const fixture = TestBed.createComponent(AppComponent);
  //   const app = fixture.componentInstance;
  //   expect(app.title).toEqual('CheetahOs');
  // });

  it('should render hello world', () => {
    const fixture = TestBed.createComponent(TitleComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent)
        .toContain('Hello, World!');
  });
});
