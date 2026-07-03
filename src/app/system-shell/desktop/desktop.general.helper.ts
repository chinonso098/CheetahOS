
import { NestedMenuItem } from "src/app/shared/system-ui-components/menu/menu.types";
import { ActivityType } from "src/app/system-files/commons/common.enums";
import { CommonFunctions } from "src/app/system-files/commons/common.functions";
import { Activity } from "src/app/system-files/commons/common.interfaces";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/fs/file.info";
import { AppLaunchDescriptor } from "./desktop.types";



// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopGeneralHelper {
    const MARKDOWN_VIEWER_APP ="markdownviewer";
    const CLIPPY_APP = "clippy";
    const PHOTOS_APP = "photoviewer";

  /**
   * Builds the `FileInfo` for an app launch and decides whether the launch
   * is trackable (clippy spawn-ticks are excluded).  Pure: the caller is
   * responsible for calling `ProcessHandlerService.runApplication` on the
   * returned `file` and `CommonFunctions.trackActivity` on the returned
   * `activityToTrack` (when non-null).
   */
  export const prepareAppLaunch = (arg0: string, screenShot?: FileInfo): AppLaunchDescriptor => {
    let file = new FileInfo();
    const appPath = 'None';
    file.setOpensWith = arg0;

    if (arg0 === MARKDOWN_VIEWER_APP) {
      file.setCurrentPath = Constants.DESKTOP_PATH;
      file.setContentPath = '/Users/Documents/Credits.md';
    }

    let activityToTrack: Activity | null = null;
    if (arg0 !== CLIPPY_APP) {
      activityToTrack = CommonFunctions.getTrackingActivity(ActivityType.APPS, arg0, appPath);
    }

    if (arg0 === PHOTOS_APP) {
      file = (screenShot) ? screenShot : new FileInfo();
      // Mirrors prior behaviour: the photos branch always tracks, even though
      // the if-tree above also produced an activity for the same arg0.
      activityToTrack = CommonFunctions.getTrackingActivity(ActivityType.APPS, arg0, appPath);
    }

    return { file, activityToTrack };
  }

  export const getScreenShotTimeStamp = ():string=>{
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = (hours >= 12) ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    //const formatted = now.toISOString().replace(/[:T]/g, '-').split('.')[0];

    return `${formattedHours}_${formattedMinutes}_${seconds}_${ampm}`;
  }

  export const handleBuildViewByMenu = ( smallIconAction: (event: MouseEvent) => void, isSmallIcon:boolean,
    mediumIconAction: (event: MouseEvent) => void, isMediumIcon:boolean,
    largeIconAction: (event: MouseEvent) => void, isLargeIcon:boolean,
    autoArrangeIconAction: (event: MouseEvent) => void, autoArrangeIcons:boolean,
    autoAlignIconsAction: (event: MouseEvent) => void, autoAlignIcons:boolean,
    showDesktopIconsAction: (event: MouseEvent) => void, showDsktpIcons:boolean):NestedMenuItem[] =>{
    const empty = Constants.EMPTY_STRING;
  
    const smallIcon:NestedMenuItem={ icon:empty, label:'Small icons',  action: smallIconAction,  variables:isSmallIcon, 
      emptyline:false, styleOption:'A' }

    const mediumIcon:NestedMenuItem={ icon:empty, label:'Medium icons',  action: mediumIconAction,  variables:isMediumIcon, 
      emptyline:false, styleOption:'A' }

    const largeIcon:NestedMenuItem={ icon:empty, label:'Large icons', action: largeIconAction, variables:isLargeIcon,
      emptyline:true, styleOption:'A' }

    const autoArrangeIcon:NestedMenuItem={ icon:empty, label:'Auto arrange icons',  action: autoArrangeIconAction,  variables:autoArrangeIcons, 
      emptyline:false, styleOption:'B' }

    const autoAlign:NestedMenuItem={ icon:empty, label:'Align icons to grid',  action: autoAlignIconsAction,  variables:autoAlignIcons, 
      emptyline:true, styleOption:'B' }

    const showDesktopIcons:NestedMenuItem={ icon:empty, label:'Show desktop icons',  action: showDesktopIconsAction, variables:showDsktpIcons,
      emptyline:false,  styleOption:'B' }

    const viewByMenu = [smallIcon,mediumIcon,largeIcon, autoArrangeIcon, autoAlign,showDesktopIcons];

    return viewByMenu;
  }

  export const handleBuildSortByMenu = (sortByNameMAction: (event: MouseEvent) => void, isSortByName:boolean,
    sortBySizeMAction: (event: MouseEvent) => void, isSortBySize:boolean,
    sortByItemTypeMAction: (event: MouseEvent) => void, isSortByItemType:boolean,
    sortByDateModifiedMAction: (event: MouseEvent) => void, isSortByDateModified:boolean): NestedMenuItem[]=> {

    const sortByName:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Name',  action: sortByNameMAction,  variables:isSortByName , 
      emptyline:false, styleOption:'A' }

    const sortBySize:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Size',  action: sortBySizeMAction,  variables:isSortBySize , 
      emptyline:false, styleOption:'A' }

    const sortByItemType:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Item type',  action: sortByItemTypeMAction,  variables:isSortByItemType, 
      emptyline:false, styleOption:'A' }

    const sortByDateModified:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Date modified',  action: sortByDateModifiedMAction,  variables:isSortByDateModified, 
      emptyline:false, styleOption:'A' }

    const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified];

    return sortByMenu
  }

}