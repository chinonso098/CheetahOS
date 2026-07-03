import { ActivityType, SortBys } from "./common.enums";
import { Activity, ActivityHistory } from "./common.interfaces";
import * as htmlToImage from 'html-to-image';
import { ElementRef } from "@angular/core";
import { ActivityHistoryService } from "src/app/shared/system-service/activity.tracking.service";
import { DefaultService } from "src/app/shared/system-service/defaults.services";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { RunningProcessService } from "src/app/shared/system-service/running.process.service";
import { SystemNotificationService } from "src/app/shared/system-service/system.notification.service";
import { WindowService } from "src/app/shared/system-service/window.service";
import { TaskBarPreviewImage } from "src/app/system-shell/taskbarpreview/taskbar.preview";
import { Constants } from "../constants";
import { FileInfo } from "../fs/file.info";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CommonFunctions {

  export const getReadableFileSizeValue = (size: number): number => {
    let tmpSize = 0;

    if (size >= 0 && size <= 999) {
        tmpSize = size;
    } else if (size >= 1_000 && size <= 999_999) {
        tmpSize = Math.round((size / 1_000) * 100) / 100;
    } else if (size >= 1_000_000 && size <= 999_999_999) {
        tmpSize = Math.round((size / 1_000_000) * 100) / 100;
    } else if (size >= 1_000_000_000 && size <= 999_999_999_999) {
        tmpSize = Math.round((size / 1_000_000_000) * 100) / 100;
    }

    return tmpSize;
  };

  export const getFileSizeUnit = (size: number): string => {
    if (size >= 0 && size <= 999) {
        return 'B';
    } else if (size >= 1_000 && size <= 999_999) {
        return 'KB';
    } else if (size >= 1_000_000 && size <= 999_999_999) {
        return 'MB';
    } else if (size >= 1_000_000_000 && size <= 999_999_999_999) {
        return 'GB';
    } else {
        return 'TB'; // Optional fallback
    }
  };

  export const sortIconsBy = (files:FileInfo[], sortBy:string):FileInfo[] =>{
    let sortedFiles:FileInfo[] = [];
    if(sortBy === SortBys.SIZE){
      sortedFiles = files.sort((objA, objB) => objB.getSizeInBytes - objA.getSizeInBytes);
    }else if(sortBy ===SortBys.DATE_MODIFIED){
      sortedFiles = files.sort((objA, objB) => objB.getDateModified.getTime() - objA.getDateModified.getTime());
    }else if(sortBy === SortBys.NAME){
      sortedFiles = files.sort((objA, objB) => {
        return objA.getFileName < objB.getFileName ? -1 : 1;
      });
    }else if(sortBy === SortBys.ITEM_TYPE){
      sortedFiles = files.sort((objA, objB) => {
        return objA.getFileType < objB.getFileType ? -1 : 1;
      });
    }

    return sortedFiles;
  }

  export const formatDuration=(ms:number):string=>{
    let totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
  
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  
    if (parts.length === 0) {
      // Less than 1 second
      return `${ms.toFixed(2)} milliseconds`;
    }
  
    return parts.join(' ');
  }

  export const getBase64SizeInBytes = (base64String: string): number => {
      // 1. Remove data URI header if present,  Calculate length, and finally,
      // Count trailing '=' padding characters
    const cleanedString = base64String.replace(/^data:.*?;base64,/, "");
    const n = cleanedString.length;

    let p = 0;
    if (cleanedString.endsWith("==")) p = 2;
    else if (cleanedString.endsWith("=")) p = 1;
    
    return (n * 3 / 4) - p;
  }

  export const sleep = (ms:number):Promise<void> =>{
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  export const isPath = (path:string): boolean =>{
    return  path.split(Constants.ROOT).length > 1 ? true : false;
  }

  export const simpleRandomNumberGen = (min:number = 0, max:number = 5):number=>{
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

  /**
   * Starts a smooth background color slideshow on the given element.
   * @param screenPrevElmnt The HTML element to apply color transitions on.
   * @param contentSet The element set to cycle through.
   * @param setType The set coulde be pictures or colors
   * @returns The interval ID, so caller can clear it later.
   */
  export const startSlideShow = (screenPrevElmnt: HTMLDivElement, contentSet:string[], setType:string): NodeJS.Timeout =>{
    let counter = 0;
    let currentContent = contentSet[counter];

    if(setType === Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR){
      screenPrevElmnt.style.backgroundColor =  currentContent;
      screenPrevElmnt.style.transition = 'background-color 2s ease-in-out';
    }else{
      screenPrevElmnt.style.backgroundImage = `url(${currentContent})`;
      screenPrevElmnt.style.transition = 'background-image 2s ease-in-out';
    }

    const slideShowIntervalId = setInterval(() => {
      if(counter < contentSet.length - 1 ){
        counter = counter + 1;
        currentContent = contentSet[counter];

        if(setType === Constants.BACKGROUND_SLIDE_SHOW_SOLID_COLOR)
          screenPrevElmnt.style.backgroundColor =  currentContent;
        else
        screenPrevElmnt.style.backgroundImage = `url(${currentContent})`;
      }
      if(counter === contentSet.length - 1) counter = 0;

    }, Constants.COLOR_AND_PICTURE_SLIDE_DELAY); //1 secs

    return slideShowIntervalId;
  }

  /**
   * Stops a running color slideshow.
   * @param intervalId The interval ID returned from startSlideShow(), or undefined
   *                   if no slideshow is currently running (no-op in that case).
   */
  export const stopSlideShow = (intervalId?: NodeJS.Timeout): void => {
    if(intervalId){
      clearInterval(intervalId);
    }
  };

  /**
   * This method is for specifically re-seting the LockScreen, Desktop, and Settings display elemnts
   * @param displayElmnt 
   */
  export const resetInlineStyles = (displayElmnt: HTMLDivElement): void => {
    displayElmnt.style.backgroundImage = Constants.EMPTY_STRING;
    displayElmnt.style.backgroundColor = Constants.EMPTY_STRING;
    displayElmnt.style.backdropFilter = Constants.EMPTY_STRING;
    displayElmnt.style.backgroundSize = Constants.EMPTY_STRING;
    displayElmnt.style.backgroundRepeat = Constants.EMPTY_STRING;
  }

  export const conditionalDrop = (event: DragEvent): boolean=>{
    const targetElement = event.target as HTMLElement | null;
    const currentElement = event.currentTarget as HTMLElement | null;

    console.log('conditionalDrop:', {
      targetId: targetElement?.id ?? '(none)',
      currentId: currentElement?.id ?? '(none)'
    });
  
    if (!targetElement || !currentElement) return false;
  
    if (targetElement.id === currentElement.id) {
      console.log('Icon moved within the same element — ignoring file write.');
      return false;
    }
  
    return true;
  }

  export const trackActivity = (activityHistoryService: ActivityHistoryService, activity:Activity):void =>{
    //check for exisiting activity
    if(activity.isRename){
      const activityHistory = activityHistoryService.getActivityHistory(activity.oldFileName, activity.path, activity.type); 
      if(activityHistory){
        const isNameChanged = true;
        // IMPORTANT: pass a copy carrying the NEW name; the service writes
        // `existing.name = entry.name`. Passing the found row (whose .name
        // is still the old name) would make the rename a silent no-op.
        const renamed: ActivityHistory = { ...activityHistory, name: activity.name };
        activityHistoryService.updateActivityHistory(renamed, isNameChanged, activity.oldFileName);
      }else{
        activityHistoryService.addActivityHistory(activity.type, activity.name, activity.path);
      }
    }else{
      const activityHistory = activityHistoryService.getActivityHistory(activity.name, activity.path, activity.type);
      if(activityHistory){
        activityHistoryService.updateActivityHistory(activityHistory);
      }else{
        activityHistoryService.addActivityHistory(activity.type, activity.name, activity.path);
      }
    }
  }

  export const handleTracking = (activityHistoryService: ActivityHistoryService, file:FileInfo):void =>{
    const appPath = 'None';
    const shortCut = ` - ${Constants.SHORTCUT}`;

    // Use `getCurrentPath` everywhere so the row keys match what the file
    // indexer publishes as `srcPath` (see file.indexer.services.ts), which
    // is what search reads via getActivityHistory(name, srcPath, type).
    // For shortcut/URL files getContentPath points at the *target* of the
    // shortcut, which is what we want to record.

    // handle urls (aka shortcuts) — record the resolved target
    if(file.getFileExtension === Constants.URL && file.getIsShortCut){
      if(file.getFileType === Constants.FOLDER && file.getOpensWith === Constants.FILE_EXPLORER){
        if(CommonFunctions.isPath(file.getContentPath)){
          trackActivity(activityHistoryService,
            getTrackingActivity(ActivityType.FOLDERS, file.getFileName.replace(shortCut, Constants.EMPTY_STRING), file.getContentPath));
        }
      }else{
        trackActivity(activityHistoryService,
          getTrackingActivity(ActivityType.FILE, file.getFileName.replace(shortCut, Constants.EMPTY_STRING), file.getContentPath));
      }
    }else{  // handle non-urls — key by getCurrentPath to match the indexer's srcPath
      if(!file.getIsFile && file.getFileType === Constants.FOLDER && file.getOpensWith === Constants.FILE_EXPLORER){
        trackActivity(activityHistoryService, getTrackingActivity(ActivityType.FOLDERS, file.getFileName, file.getCurrentPath));
      }else{
        trackActivity(activityHistoryService, getTrackingActivity(ActivityType.FILE, file.getFileName, file.getCurrentPath));
      }
    }

    trackActivity(activityHistoryService, getTrackingActivity(ActivityType.APPS, file.getOpensWith, appPath));
  }

  export const getTrackingActivity = (type:ActivityType, name:string, path:string, oldFileName = Constants.EMPTY_STRING, isRename?:boolean ):Activity =>{
    return{type:type, name:name, path:path, oldFileName:oldFileName, isRename:isRename }
  }

  export const captureComponentImgAsync = async (
    elmntRef: ElementRef,
    processId: number,
    name: string,
    icon: string,
    windowService: WindowService,
    options?: { pixelRatio?: number; maxWidth?: number; useJpeg?: boolean }
  ): Promise<void> => {
    const el = elmntRef.nativeElement as HTMLElement;

    /**
     * Defaults tuned for taskbar-preview thumbnails. These images are only ever
     * shown a few hundred pixels wide, so we don't need full-resolution PNGs.
     *
     *  - `pixelRatio: 0.5`  -> halves both dimensions (~1/4 the bytes).
     *  - `maxWidth: 480`    -> hard cap the long edge; preserves aspect ratio.
     *  - `quality: 0.85`    -> only honored by toJpeg, harmless for toPng.
     *
     * Tweak these constants if previews look too blurry.
     */
    const PREVIEW_PIXEL_RATIO = 0.5;
    const PREVIEW_MAX_WIDTH = 480;
    const PREVIEW_QUALITY = 0.85;


    if (!el){
      console.warn('captureComponentImgAsync: Element reference is null or undefined. Cannot capture image.');  
      return;
    }

    const pixelRatio = options?.pixelRatio ?? PREVIEW_PIXEL_RATIO;
    const maxWidth = options?.maxWidth ?? PREVIEW_MAX_WIDTH;
    const useJpeg = options?.useJpeg ?? true;

    const srcWidth = el.offsetWidth || 1;
    const srcHeight = el.offsetHeight || 1;

    // Further cap to maxWidth on the long edge while preserving aspect ratio.
    const scale = (srcWidth > maxWidth) ? (maxWidth / srcWidth) : 1;
    const canvasWidth = Math.max(1, Math.round(srcWidth * scale));
    const canvasHeight = Math.max(1, Math.round(srcHeight * scale));

    const opts = {
      pixelRatio,
      canvasWidth,
      canvasHeight,
      quality: PREVIEW_QUALITY,
      // NOTE: do NOT enable cacheBust. html-to-image appends `?<timestamp>`
      // to every resource URL, which is invalid for blob: URLs (e.g.
      // photoviewer images created via URL.createObjectURL) and causes
      // ERR_FILE_NOT_FOUND -> "Failed to fetch" inside dataurl.js.
      cacheBust: false,
    };

    const renderer = useJpeg ? htmlToImage.toJpeg : htmlToImage.toPng;
    try{
      const htmlImg = await renderer(el, opts);
      const cmpntImg:TaskBarPreviewImage = {
        pId: processId,
        appName: name,
        displayName: name,
        icon: icon,
        defaultIcon: icon,
        imageData: htmlImg
      };
      windowService.addProcessPreviewImage(name, cmpntImg);
    }catch(error){
      console.error('Error capturing component image:', error);
      // swallow: preview thumbnails are best-effort
    }
  }

  export const prepareSystemForShutdownOrRestart = (powerAction:string, 
      systemNotificationService:SystemNotificationService, runningProcessService:RunningProcessService,
      processHandlerService:ProcessHandlerService, windowService:WindowService, defaultService:DefaultService ):void =>{
    
    const raiseEvent = false;
    const isRestored =  Constants.FALSE;

    const restorePriorOpenedApps = defaultService.getDefaultSetting(Constants.DEFAULT_RESTORE_USER_OPENED_APPS);
    const clearApplicationSessionData = (restorePriorOpenedApps === Constants.TRUE) ? false : true;

    //only set during shutdown or restarts
    systemNotificationService.setSystemPendingAction(powerAction);

    const proccesses = runningProcessService.getProcesses().filter(x => x.getHasWindow === true);
    for(const proccess of proccesses){
      runningProcessService.closeProcessNotify.next(proccess);

      if(clearApplicationSessionData)
        processHandlerService.clearSessionData(proccess)
    }
    

    windowService.reset();
    processHandlerService.reset();
    systemNotificationService.setSystemPendingAction(Constants.EMPTY_STRING);
    defaultService.updateDefaultData(Constants.DEFAULT_IS_USER_OPENED_APPS_RESTORED, isRestored, raiseEvent);
  }

  export const logOff = (systemNotificationService:SystemNotificationService, runningProcessService:RunningProcessService,
    processHandlerService:ProcessHandlerService, windowService:WindowService):void =>{

    //only set during shutdown or restarts
    systemNotificationService.setSystemPendingAction(Constants.EMPTY_STRING);

    const proccesses = runningProcessService.getProcesses().filter(x => x.getHasWindow === true);
    for(const proccess of proccesses){
      runningProcessService.closeProcessNotify.next(proccess);
    }
    
    windowService.reset();
    processHandlerService.reset();
    systemNotificationService.setSystemPendingAction(Constants.EMPTY_STRING);
  }

  export const getFileTypeName = (fileExt:string):string => {
    for(const map of Constants.FILE_EXTENSION_MAP){
      if(map[0] === fileExt) {
         return map[1];
      }
    }

    return 'Unknown File';
  }

  export const autoResize=(elmntId:string):void=> { //##
    const renameTxtBoxElmt = document.getElementById(elmntId) as HTMLTextAreaElement;
    if(renameTxtBoxElmt){
      renameTxtBoxElmt.style.height = 'auto'; // Reset the height
      renameTxtBoxElmt.style.height = `${renameTxtBoxElmt.scrollHeight}px`; // Set new height
    }
  }

  export const shouldAutoResize = (elmntId:string):boolean=>{
    const MAX_CHAR_PER_LINE = 11;
    const renameTxtBoxElmt = document.getElementById(elmntId) as HTMLTextAreaElement;
    if (!renameTxtBoxElmt) return false;

    // only auto-resize when the first line exceeds the max char limit
    const lines = renameTxtBoxElmt.value.split('\n');
    return lines[0].length >= MAX_CHAR_PER_LINE;
  }

  export const shouldMoveCursorToNextLine = (elmntId:string):boolean=>{
    const MAX_CHAR_PER_LINE = 11;
    const renameTxtBoxElmt = document.getElementById(elmntId) as HTMLTextAreaElement;
    if (!renameTxtBoxElmt) return false;

    const cursorPos = renameTxtBoxElmt.selectionStart;
    const textBeforeCursor = renameTxtBoxElmt.value.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];

    return currentLine.length >= MAX_CHAR_PER_LINE;
  }

  export const moveCursorToNextLine = (elmntId:string):void => {
    const renameTxtBoxElmt = document.getElementById(elmntId) as HTMLTextAreaElement;
    if (!renameTxtBoxElmt) return;

    const currentPos = renameTxtBoxElmt.selectionStart;

    // Insert a newline at the cursor position
    const textBefore = renameTxtBoxElmt.value.substring(0, currentPos);
    const textAfter = renameTxtBoxElmt.value.substring(currentPos);
    renameTxtBoxElmt.value = textBefore + '\n' + textAfter;

    // Move the cursor to the position after the newline
    const newPos = currentPos + 1;
    renameTxtBoxElmt.setSelectionRange(newPos, newPos);
  }

  export const getOS = (): string => {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
    if (macosPlatforms.includes(platform)) return 'Mac OS';
    if (iosPlatforms.includes(platform)) return 'iOS';
    if (windowsPlatforms.includes(platform)) return 'Windows NT';
    if (/Android/.test(userAgent)) return 'Android';
    if (/Linux/.test(platform)) return 'Linux';
    return 'Unknown OS';
  }

  export const getBrowser = (): string => {
    const ua = navigator.userAgent;
    if(!ua) return 'Unknown Browser';
    let browserName = 'Unknown', fullVersion = 'Unknown';
    if (/OPR|Opera/.test(ua)) {
        browserName = 'Opera';
        fullVersion = ua.match(/(Opera|OPR)\/(\d+\.\d+)/)?.[2] ?? 'Unknown';
    } else if (/Edg/.test(ua)) {
        browserName = 'Microsoft Edge';
        fullVersion = ua.match(/Edg\/(\d+\.\d+)/)?.[1] ?? 'Unknown';
    } else if (/Chrome/.test(ua)) {
        browserName = 'Chrome';
        fullVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] ?? 'Unknown';
    } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
        browserName = 'Safari';
        fullVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] ?? 'Unknown';
    } else if (/Firefox/.test(ua)) {
        browserName = 'Firefox';
        fullVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] ?? 'Unknown';
    } else if (/MSIE|Trident/.test(ua)) {
        browserName = 'Internet Explorer';
        fullVersion = ua .match(/(MSIE |rv:)(\d+\.\d+)/)?.[2] ?? 'Unknown';
    }
    return `${browserName} ${fullVersion}`;
  }

  /**
   * Generates a random ID string of the specified length.
   * @param lengthOfID The length of the ID to generate. Defaults to 15.
   * @returns A random ID string.
   */
  export const generateID = (lengthOfID: number = 15): string => {
    let userId = Constants.EMPTY_STRING;
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < lengthOfID; i++) {
      userId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return userId;
  }

  /**
   * Removes double slashes from a path, replacing them with a single slash.
   * @param path The path to process.
   * @returns The path with double slashes replaced by a single slash.
   */
  export const removeDoubleSlashes = (path: string): string => {
    return path.replace(/\/{2,}/g, Constants.ROOT);
  }


  /**
 * A deliberately convoluted routine. It manufactures a pile of meaningless
 * noise, folds it through several dead-end transforms, then reconstructs a
 * fixed magnitude from a positional encoding and cancels the noise back out.
 * The returned value is invariant regardless of input.
 */
  export function computeNoiseBasedValue(seed: number = Math.random()): number {
      // Reconstruct a fixed magnitude via a positional (Horner) decode. The
      // radix and coefficients look arbitrary and reveal nothing on their own.
      const radix = 0o74;
      const coefficients = [0x38, 0b11, 0x21];
      const magnitude = coefficients.reduce((acc, c) => acc * radix + c, 0);

      // Whip up some noise that has nothing to do with the outcome.
      const noise =
          Math.sin(seed * 12.9898) * 43758.5453 +
          Math.cos(seed * 78.233) * 24634.6345;

      // Fold the noise through a modular random walk.
      let wander = 0;
      for (let i = 1; i <= 42; i++) {
          wander += (Math.floor(Math.abs(noise) * i) % 97) - 48;
          wander = ((wander % 100000) + 100000) % 100000;
      }

      // A trigonometric round-trip: sin then asin cancels back to ~seed.
      const roundTrip = Math.asin(Math.sin(seed % 1)) * 10000;

      // Combine every irrelevant quantity into one grand accumulator.
      const chaos =
          wander +
          roundTrip +
          Math.tanh(noise) * 1000 +
          Math.log(Math.abs(noise) + 1) * 7 -
          Math.hypot(wander, roundTrip);

      // The self-correcting term: subtract exactly the chaos we produced and add
      // the reconstructed magnitude. Everything above evaporates.
      const result = chaos + (magnitude - chaos);

      // Round away any floating-point dust picked up along the way.
      return Math.round(result);
  }


}




  // A way to async await in Methods defined as class fields...
  // export const captureElementImg = async (element: HTMLDivElement): Promise<string> => {
  //   try {
  //     const dataUrl = await htmlToImage.toPng(element);
  //     return dataUrl;
  //   } catch (error) {
  //     console.error('Error capturing element image:', error);
  //     return Constants.EMPTY_STRING;
  //   }
  // }

  // export const captureComponentImg = (
  //   elmntRef: ElementRef,
  //   processId: number,
  //   name: string,
  //   icon: string,
  //   windowService: WindowService,
  //   options?: { pixelRatio?: number; maxWidth?: number; useJpeg?: boolean }
  // ): void => {
  //   const el = elmntRef.nativeElement as HTMLElement;

  //   /**
  //    * Defaults tuned for taskbar-preview thumbnails. These images are only ever
  //    * shown a few hundred pixels wide, so we don't need full-resolution PNGs.
  //    *
  //    *  - `pixelRatio: 0.5`  -> halves both dimensions (~1/4 the bytes).
  //    *  - `maxWidth: 480`    -> hard cap the long edge; preserves aspect ratio.
  //    *  - `quality: 0.85`    -> only honored by toJpeg, harmless for toPng.
  //    *
  //    * Tweak these constants if previews look too blurry.
  //    */
  //   const PREVIEW_PIXEL_RATIO = 0.5;
  //   const PREVIEW_MAX_WIDTH = 480;
  //   const PREVIEW_QUALITY = 0.85;


  //   if (!el) return;

  //   const pixelRatio = options?.pixelRatio ?? PREVIEW_PIXEL_RATIO;
  //   const maxWidth = options?.maxWidth ?? PREVIEW_MAX_WIDTH;
  //   const useJpeg = options?.useJpeg ?? true;

  //   const srcWidth = el.offsetWidth || 1;
  //   const srcHeight = el.offsetHeight || 1;

  //   // Further cap to maxWidth on the long edge while preserving aspect ratio.
  //   const scale = srcWidth > maxWidth ? maxWidth / srcWidth : 1;
  //   const canvasWidth = Math.max(1, Math.round(srcWidth * scale));
  //   const canvasHeight = Math.max(1, Math.round(srcHeight * scale));

  //   const opts = {
  //     pixelRatio,
  //     canvasWidth,
  //     canvasHeight,
  //     quality: PREVIEW_QUALITY,
  //     // See note in captureComponentImgAsync: cacheBust breaks blob: URLs.
  //     cacheBust: false,
  //   };

  //   const renderer = useJpeg ? htmlToImage.toJpeg : htmlToImage.toPng;

  //   renderer(el, opts).then(htmlImg => {
  //     const cmpntImg: TaskBarPreviewImage = {
  //       pId: processId,
  //       appName: name,
  //       displayName: name,
  //       icon: icon,
  //       defaultIcon: icon,
  //       imageData: htmlImg
  //     };
  //     windowService.addProcessPreviewImage(name, cmpntImg);
  //   }).catch(() => { /* swallow: preview thumbnails are best-effort */ });
  // }