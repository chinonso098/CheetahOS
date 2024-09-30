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
import { ClockComponent } from './system-apps/clock/clock.component';
import { StartButtonComponent } from './system-apps/startbutton/startbutton.component';
import { StartMenuComponent } from './system-apps/startmenu/startmenu.component';
import { TaskBarPreviewComponent } from './system-apps/taskbarpreview/taskbarpreview.component';
import { TaskBarEntriesComponent } from './system-apps/taskbarentries/taskbarentries.component';
import { TaskBarEntryComponent } from './system-apps/taskbarentry/taskbarentry.component';
import { FileExplorerComponent } from './system-apps/fileexplorer/fileexplorer.component';
import { WindowComponent } from './shared/system-component/window/window.component';
import { FileManagerComponent } from './system-apps/filemanager/filemanager.component';
import { GreetingComponent } from './user-apps/greeting/greeting.component';
import { TaskmanagerComponent } from './system-apps/taskmanager/taskmanager.component';
import { TaskmanagerMiniComponent } from './system-apps/taskmanager/taskmanager.mini.component';
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

import { SafeUrlPipe } from './shared/system-pipes/safe.resource.url.pipe';
import { TruncatePipe } from './shared/system-pipes/string.shorten.pipe';

import { HighlightDirective } from './shared/system-component/window/window.btn.highlight.directives';
import { TaskBarEntryHighlightDirective } from './system-apps/taskbarentries/taskbar.entry.highlight.directives';
import { LongPressDirective } from './system-apps/audioplayer/long.press.directive';
import { ColumnResizeDirective } from './system-apps/taskmanager/taskmanager.column-resize.directive';
import { KeyPressCaptureDirective } from './system-apps/terminal/key.press.capture.directive';


@NgModule({
  declarations: [
    TitleComponent,
    AppComponent,
    DesktopComponent,
    TaskbarComponent,
    ClockComponent,
    StartButtonComponent,
    StartMenuComponent,
    TaskBarPreviewComponent,
    TaskBarEntriesComponent,
    TaskBarEntryComponent,
    FileExplorerComponent,
    WindowComponent,
    FileManagerComponent,
    GreetingComponent,
    TaskmanagerComponent,
    TaskmanagerMiniComponent,
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
 

    HighlightDirective,
    TaskBarEntryHighlightDirective,
    LongPressDirective,
    ColumnResizeDirective,
    KeyPressCaptureDirective,

    SafeUrlPipe,
    TruncatePipe
    
  ],
  imports: [
    BrowserModule,
    AngularDraggableModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    FormsModule,
    MonacoEditorModule.forRoot(), // use forRoot() in main app module only.
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
