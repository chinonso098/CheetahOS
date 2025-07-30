import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AngularDraggableModule } from 'angular2-draggable';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';

import { AppComponent } from './app.component';
import { TitleComponent } from './user-apps/title/title.component';
import { DesktopComponent } from './system-apps/desktop/desktop.component';
import { TaskbarComponent } from './system-apps/taskbar/taskbar.component';
import { StartButtonComponent } from './system-apps/startbutton/startbutton.component';
import { StartMenuComponent } from './system-apps/startmenu/startmenu.component';
import { TaskBarPreviewComponent } from './system-apps/taskbarpreview/taskbarpreview.component';
import { TaskBarEntriesComponent } from './system-apps/taskbarentries/taskbarentries.component';
import { TaskBarEntryComponent } from './system-apps/taskbarentry/taskbarentry.component';
import { FileExplorerComponent } from './system-apps/fileexplorer/fileexplorer.component';
import { WindowComponent } from './shared/system-component/window/window.component';
import { GreetingComponent } from './user-apps/greeting/greeting.component';
import { TaskmanagerComponent } from './system-apps/taskmanager/taskmanager.component';
import { JSdosComponent } from './user-apps/jsdos/jsdos.component';
import { VideoPlayerComponent } from './system-apps/videoplayer/videoplayer.component';
import { AudioPlayerComponent } from './system-apps/audioplayer/audioplayer.component';
import { TerminalComponent } from './system-apps/terminal/terminal.component';
import { MenuComponent } from './shared/system-component/menu/menu.component';
import { PhotoViewerComponent } from './system-apps/photoviewer/photoviewer.component';
import { TextEditorComponent } from './system-apps/texteditor/texteditor.component';
import { RuffleComponent } from './user-apps/ruffle/ruffle.component';
import { DialogComponent } from './shared/system-component/dialog/dialog.component';
import { CodeEditorComponent } from './user-apps/codeeditor/codeeditor.component';
import { PropertiesComponent } from './shared/system-component/properties/properties.component'; 
import { MarkDownViewerComponent } from './user-apps/markdownviewer/markdownviewer.component';
import { FileTreeViewComponent } from './shared/system-component/filetreeview/filetreeview.component';
import { CheetahComponent } from './system-apps/cheetah/cheetah.component';
import { ClippyComponent } from "./system-apps/clippy/clippy.component";
import { ChatterComponent } from './system-apps/chatter/chatter.component';
import { RunSystemComponent } from './system-apps/runsystem/runsystem.component';
import { VolumeControlComponent } from './system-apps/volumecontrol/volumecontrol.component';
import { LoginComponent } from './system-apps/login/login.component';
import { PowerOnOffComponent } from './system-apps/poweronoff/poweronoff.component';
import { SearchComponent } from './system-apps/search/search.component';
import { SystemtrayComponent } from './system-apps/systemtray/systemtray.component';
import { TaskbarpreviewsComponent } from './system-apps/taskbarpreviews/taskbarpreviews.component';
import { WarpingstarfieldComponent } from './user-apps/warpingstarfield/warpingstarfield.component';
import { BoidsComponent } from './user-apps/boids/boids.component';
import { BasicWindowComponent } from './shared/system-component/basicwindow/basicwindow.component';

import { SafeUrlPipe } from './shared/system-pipes/safe.resource.url.pipe';
import { TruncatePipe } from './shared/system-pipes/string.shorten.pipe';

import { HighlightDirective } from './shared/system-component/window/window.btn.highlight.directives';
import { TaskBarEntryHighlightDirective } from './system-apps/taskbarentries/taskbar.entries.highlight.directives';
import { LongPressDirective } from './system-apps/audioplayer/long.press.directive';
import { ColumnResizeDirective } from './system-apps/taskmanager/taskmanager.column-resize.directive';
import { FileExplorerColumnResizeDirective } from './system-apps/fileexplorer/fileexplorer.column-resize.directive';
import { KeyPressCaptureDirective } from './system-apps/terminal/key.press.capture.directive';
import { AlphaNumericDirective } from './system-apps/chatter/chatter.textbox.directives';
import { ParticaleFlowComponent } from './user-apps/particaleflow/particaleflow.component';





@NgModule({
  declarations: [
    TitleComponent,
    AppComponent,
    DesktopComponent,
    TaskbarComponent,
    StartButtonComponent,
    StartMenuComponent,
    TaskBarPreviewComponent,
    TaskBarEntriesComponent,
    TaskBarEntryComponent,
    FileExplorerComponent,
    WindowComponent,
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
    ChatterComponent,
    RunSystemComponent,
    VolumeControlComponent,
    LoginComponent,
    PowerOnOffComponent,
    SearchComponent,
    SystemtrayComponent,

    HighlightDirective,
    TaskBarEntryHighlightDirective,
    LongPressDirective,
    ColumnResizeDirective,
    KeyPressCaptureDirective,
    AlphaNumericDirective,
    FileExplorerColumnResizeDirective,

    SafeUrlPipe,
    TruncatePipe,
    TaskbarpreviewsComponent,
    WarpingstarfieldComponent,
    BoidsComponent,
    BasicWindowComponent,
    ParticaleFlowComponent
    
  ],
  imports: [
    BrowserModule,
    AngularDraggableModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    FormsModule,
    MonacoEditorModule.forRoot()
],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
