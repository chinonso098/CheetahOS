import { NestedMenuItem } from "src/app/shared/system-component/menu/menu.types";
import { ActivityHistoryService } from "src/app/shared/system-service/activity.tracking.service";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { ActivityType } from "src/app/system-files/common.enums";
import { CommonFunctions } from "src/app/system-files/common.functions";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopGeneralHelper {

    const MARKDOWN_VIEWER_APP ="markdownviewer";
    const CLIPPY_APP = "clippy";
    const PHOTOS_APP = "photoviewer";

    export const autoResize=(selectedElementId:number):void=> { //##
        const renameTxtBoxElmt = document.getElementById(`renameTxtBox${selectedElementId}`) as HTMLTextAreaElement;
        if(renameTxtBoxElmt){
        renameTxtBoxElmt.style.height = 'auto'; // Reset the height
        renameTxtBoxElmt.style.height = renameTxtBoxElmt.scrollHeight + 'px'; // Set new height
        }
    }

   export const  initializeApplication =(arg0:string, 
        processHandlerService:ProcessHandlerService, 
        activityHistoryService:ActivityHistoryService, screenShot?: FileInfo):void=>{

        let file = new FileInfo();
        const appPath = 'None';
        file.setOpensWith = arg0;

        if(arg0 ===  MARKDOWN_VIEWER_APP){
        file.setCurrentPath = Constants.DESKTOP_PATH;
        file.setContentPath = '/Users/Documents/Credits.md';
        }

        if(arg0 !== CLIPPY_APP){
        const activity = CommonFunctions.getTrackingActivity(ActivityType.APPS, arg0, appPath);
        CommonFunctions.trackActivity(activityHistoryService, activity);
        }

        if(arg0 === PHOTOS_APP){
        file = (screenShot)? screenShot : new FileInfo();
        const activity = CommonFunctions.getTrackingActivity(ActivityType.APPS, arg0, appPath);
        CommonFunctions.trackActivity(activityHistoryService, activity);
        }

        processHandlerService.runApplication(file);
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
    autoArrageIconAction: (event: MouseEvent) => void, autoArrangeIcons:boolean,
    autoAlignIconsAction: (event: MouseEvent) => void, autoAlignIcons:boolean,
    showDesktopIconsAction: (event: MouseEvent) => void, showDsktpIcons:boolean):NestedMenuItem[] =>{
    
        const smallIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Small icons',  action: smallIconAction,  variables:isSmallIcon, 
          emptyline:false, styleOption:'A' }
    
        const mediumIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Medium icons',  action: mediumIconAction,  variables:isMediumIcon, 
          emptyline:false, styleOption:'A' }
    
        const largeIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Large icons', action: largeIconAction, variables:isLargeIcon,
          emptyline:true, styleOption:'A' }
    
        const autoArrageIcon:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Auto arrange icons',  action: autoArrageIconAction,  variables:autoArrangeIcons, 
          emptyline:false, styleOption:'B' }
    
        const autoAlign:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Align icons to grid',  action: autoAlignIconsAction,  variables:autoAlignIcons, 
          emptyline:true, styleOption:'B' }
    
        const showDesktopIcons:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}chkmark32.png`, label:'Show desktop icons',  action: showDesktopIconsAction, variables:showDsktpIcons,
          emptyline:false,  styleOption:'B' }
    
        const viewByMenu = [smallIcon,mediumIcon,largeIcon, autoArrageIcon, autoAlign,showDesktopIcons];
    
        return viewByMenu;
    }

    export const hanldeBuildSortByMenu = (sortByNameMAction: (event: MouseEvent) => void, isSortByName:boolean,
        sortBySizeMAction: (event: MouseEvent) => void, isSortBySize:boolean,
        sortByItemTypeMAction: (event: MouseEvent) => void, isSortByItemType:boolean,
        sortByDateModifiedMAction: (event: MouseEvent) => void, isSortByDateModified:boolean,): NestedMenuItem[]=> {

        const sortByName:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Name',  action: sortByNameMAction,  variables:isSortByName , 
          emptyline:false, styleOption:'A' }
    
        const sortBySize:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Size',  action: sortBySizeMAction,  variables:isSortBySize , 
          emptyline:false, styleOption:'A' }
    
        const sortByItemType:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Item type',  action: sortByItemTypeMAction,  variables:isSortByItemType, 
          emptyline:false, styleOption:'A' }
    
        const sortByDateModified:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}circle.png`, label:'Date modified',  action: sortByDateModifiedMAction,  variables:isSortByDateModified, 
          emptyline:false, styleOption:'A' }
    
        const sortByMenu = [sortByName, sortBySize, sortByItemType, sortByDateModified];
    
        return sortByMenu
      }

}