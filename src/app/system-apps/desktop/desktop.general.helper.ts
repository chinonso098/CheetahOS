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

}