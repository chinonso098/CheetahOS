import { ActivityHistoryService } from "../shared/system-service/activity.tracking.service";
import { ActivityType, SortBys } from "./common.enums";
import { Activity } from "./common.interfaces";
import { Constants } from "./constants";
import { FileInfo } from "./file.info";

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

  export const sleep = (ms:number):Promise<void> =>{
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  export const isPath = (path:string): boolean =>{
    return  path.split(Constants.ROOT).length > 1 ? true : false;
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
   * @param intervalId The interval ID returned from startSlideShow().
   */
  export const stopSlideShow = (intervalId: NodeJS.Timeout): void => {
    if (intervalId) {
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

  export const trackActivity = (activityHistoryService: ActivityHistoryService, activity:Activity):void =>{
    //check for exisiting activity
    if(activity.isRename){
      const activityHistory = activityHistoryService.getActivityHistory(activity.oldFileName, activity.path, activity.type); 
      if(activityHistory){
        const isNameChanged = true;
        activityHistoryService.updateActivityHistory(activityHistory, isNameChanged, activity.oldFileName);
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

    // handle urls (aka shortcuts)
    if(file.getFileExtension === Constants.URL && file.getIsShortCut){
      if(file.getFileType === Constants.FOLDER && file.getOpensWith === Constants.FILE_EXPLORER){       
        if(CommonFunctions.isPath(file.getContentPath)){
          trackActivity(activityHistoryService, 
          getTrackingActivity(ActivityType.FOLDERS, file.getFileName.replace(shortCut, Constants.EMPTY_STRING), file.getContentPath));
        }
      }else{
        trackActivity(activityHistoryService, getTrackingActivity(ActivityType.FILE, file.getFileName, file.getContentPath));
      }
    }else{  // handle non-urls
      if(!file.getIsFile && file.getFileType === Constants.FOLDER && file.getOpensWith === Constants.FILE_EXPLORER){
        trackActivity(activityHistoryService, getTrackingActivity(ActivityType.FOLDERS, file.getFileName, file.getContentPath));
      }else
        trackActivity(activityHistoryService, getTrackingActivity(ActivityType.FILE, file.getFileName, file.getContentPath));
    }

    trackActivity(activityHistoryService, getTrackingActivity(ActivityType.APPS, file.getOpensWith, appPath));
  }

  export const getTrackingActivity = (type:ActivityType, name:string, path:string, oldFileName = Constants.EMPTY_STRING, isRename?:boolean ):Activity =>{
    return{type:type, name:name, path:path, oldFileName:oldFileName, isRename:isRename }
  }

}
