import { ErrorHandler, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AngularDraggableModule } from 'angular2-draggable';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { provideServiceWorker } from '@angular/service-worker';

import { environment } from 'src/environments/environment';

import { AppComponent } from './app.component';
import { TitleComponent } from './applications/user-apps/title/title.component';
import { DesktopComponent } from './system-shell/desktop/desktop.component';
import { TaskbarComponent } from './system-shell/taskbar/taskbar.component';
import { SettingsComponent } from './applications/system-apps/controlpanel/settings.component';
import { StartMenuComponent } from './system-shell/startmenu/startmenu.component';
import { TaskBarPreviewComponent } from './system-shell/taskbarpreview/taskbarpreview.component';
import { TaskBarEntriesComponent } from './system-shell/taskbarentries/taskbarentries.component';
import { TaskBarEntryComponent } from './system-shell/taskbarentry/taskbarentry.component';
import { FileExplorerComponent } from './applications/system-apps/fileexplorer/fileexplorer.component';
import { PrimaryWindowComponent } from './shared/system-ui-components/window/primarywindow/primarywindow.component';
import { GreetingComponent } from './applications/user-apps/greeting/greeting.component';
import { TaskmanagerComponent } from './applications/system-apps/taskmanager/taskmanager.component';
import { JSdosComponent } from './applications/user-apps/jsdos/jsdos.component';
import { VideoPlayerComponent } from './applications/system-apps/videoplayer/videoplayer.component';
import { AudioPlayerComponent } from './applications/system-apps/audioplayer/audioplayer.component';
import { TerminalComponent } from './applications/system-apps/terminal/terminal.component';
import { MenuComponent } from './shared/system-ui-components/menu/menu.component';
import { PhotoViewerComponent } from './applications/system-apps/photoviewer/photoviewer.component';
import { TextEditorComponent } from './applications/system-apps/texteditor/texteditor.component';
import { RuffleComponent } from './applications/user-apps/ruffle/ruffle.component';
import { DialogComponent } from './shared/system-ui-components/dialog/dialog.component';
import { CodeEditorComponent } from './applications/user-apps/codeeditor/codeeditor.component';
import { PropertiesComponent } from './shared/system-ui-components/properties/properties.component'; 
import { MarkDownViewerComponent } from './applications/user-apps/markdownviewer/markdownviewer.component';
import { FileTreeViewComponent } from './shared/system-ui-components/filetreeview/filetreeview.component';
import { CheetahComponent } from './applications/system-apps/cheetah/cheetah.component';
import { ClippyComponent } from "./applications/system-apps/clippy/clippy.component";
import { ClipboardComponent } from './applications/system-apps/clipboard/clipboard.component';
import { ChatterComponent } from './applications/system-apps/chatter/chatter.component';
import { RunSystemComponent } from './applications/system-apps/runsystem/runsystem.component';
import { VolumeControlComponent } from './system-shell/volumecontrol/volumecontrol.component';
import { LoginComponent } from './system-shell/login/login.component';
import { PowerOnOffComponent } from './system-shell/poweronoff/poweronoff.component';
import { SearchComponent } from './applications/system-apps/search/search.component';
import { SystemtrayComponent } from './system-shell/systemtray/systemtray.component';
import { TaskbarpreviewsComponent } from './system-shell/taskbarpreviews/taskbarpreviews.component';
import { WarpingstarfieldComponent } from './applications/user-apps/warpingstarfield/warpingstarfield.component';
import { BoidsComponent } from './applications/user-apps/boids/boids.component';
import { SecondaryWindowComponent } from './shared/system-ui-components/window/secondarywindow/secondarywindow.component';
import { ParticaleFlowComponent } from './applications/user-apps/particaleflow/particaleflow.component';
import { PdfViewerComponent } from './applications/user-apps/pdf-viewer/pdf-viewer.component';
import { NotificationCenterComponent } from './system-shell/notificationcenter/notificationcenter.component';
import { OverFlowComponent } from './system-shell/overflow/overflow.component';
import { ScreenSaverViewerComponent } from './applications/system-apps/screensaverviewer/screensaverviewer.component';

import { SafeUrlPipe } from './shared/system-pipes/safe.resource.url.pipe';
import { TruncatePipe } from './shared/system-pipes/string.shorten.pipe';
import { GlobalErrorHandler } from './shared/system-service/global.error.handler';

import { HighlightDirective } from './shared/system-ui-components/window/window.btn.highlight.directives';
import { MouseStopDirective } from './applications/system-apps/fileexplorer/mouse.stop.directive';
import { TaskBarEntryHighlightDirective } from './system-shell/taskbarentries/taskbar.entries.highlight.directives';
import { LongPressDirective } from './applications/system-apps/audioplayer/long.press.directive';
import { ColumnResizeDirective } from './applications/system-apps/taskmanager/taskmanager.column-resize.directive';
import { FileExplorerColumnResizeDirective } from './applications/system-apps/fileexplorer/fileexplorer.column-resize.directive';
import { KeyPressCaptureDirective } from './applications/system-apps/terminal/key.press.capture.directive';
import { AlphaNumericDirective } from './applications/system-apps/chatter/chatter.textbox.directives';



@NgModule({
  declarations: [
    TitleComponent,
    AppComponent,
    DesktopComponent,
    TaskbarComponent,
    SettingsComponent,
    StartMenuComponent,
    TaskBarPreviewComponent,
    TaskBarEntriesComponent,
    TaskBarEntryComponent,
    FileExplorerComponent,
    PrimaryWindowComponent,
    GreetingComponent,
    TaskmanagerComponent,
    JSdosComponent,
    VideoPlayerComponent,
    AudioPlayerComponent,
    TerminalComponent,
    MenuComponent,
    PhotoViewerComponent,
    TextEditorComponent,
    PropertiesComponent,
    RuffleComponent,
    DialogComponent,
    CodeEditorComponent,
    MarkDownViewerComponent,
    FileTreeViewComponent,
    CheetahComponent,
    ClippyComponent,
    ClipboardComponent,
    ChatterComponent,
    RunSystemComponent,
    VolumeControlComponent,
    LoginComponent,
    PowerOnOffComponent,
    SearchComponent,
    SystemtrayComponent,
    TaskbarpreviewsComponent,
    WarpingstarfieldComponent,
    BoidsComponent,
    SecondaryWindowComponent,
    ParticaleFlowComponent,
    PdfViewerComponent,
    NotificationCenterComponent,
    OverFlowComponent,
    ScreenSaverViewerComponent,

    HighlightDirective,
    TaskBarEntryHighlightDirective,
    LongPressDirective,
    ColumnResizeDirective,
    KeyPressCaptureDirective,
    AlphaNumericDirective,
    FileExplorerColumnResizeDirective,
    MouseStopDirective,

    SafeUrlPipe,
    TruncatePipe
  ],
  imports: [
    BrowserModule,
    AngularDraggableModule,
    DragDropModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    FormsModule,
    MonacoEditorModule.forRoot()
],
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Register the Angular service worker, but ONLY in production builds.
    // `ngsw-worker.js` is emitted by the production build (serviceWorker enabled
    // in angular.json). Registration is delayed until the app stabilizes so it
    // never competes with first paint. In dev the worker isn't generated, so we
    // gate on environment.production to avoid a 404 / stale-cache headaches.
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
