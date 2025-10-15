import { ActivityHistoryService } from "src/app/shared/system-service/activity.tracking.service";
import { ProcessHandlerService } from "src/app/shared/system-service/process.handler.service";
import { ActivityType } from "src/app/system-files/common.enums";
import { CommonFunctions } from "src/app/system-files/common.functions";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopHelper {

    const MARKDOWN_VIEWER_APP ="markdownviewer";
    const CLIPPY_APP = "clippy";
    const PHOTOS_APP = "photoviewer";

    export const removeBtnStyle =(id:number):void =>{
        const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
        const figCapElement = document.getElementById(`figCap${id}`) as HTMLElement;
        if(btnElement){
          btnElement.style.backgroundColor = Constants.EMPTY_STRING;
          btnElement.style.borderColor = Constants.EMPTY_STRING;
        }
    
        if(figCapElement){
          figCapElement.style.overflow = 'hidden'; 
          figCapElement.style.overflowWrap = 'unset'
          figCapElement.style.webkitLineClamp = '2';
          figCapElement.style.zIndex = 'unset';
        }
    }

    export const  setBtnStyle =(id:number, isMouseHover:boolean, selectedElementId:number, isIconInFocusDueToPriorAction:boolean):void =>{
        const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
        const figCapElement = document.getElementById(`figCap${id}`) as HTMLElement;
        if(btnElement){
          btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';
    
    
          if(selectedElementId === id){
            (isMouseHover)? btnElement.style.backgroundColor ='#607c9c' : 
              btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
          }
    
          if(!isMouseHover && isIconInFocusDueToPriorAction){
            btnElement.style.backgroundColor = Constants.EMPTY_STRING;
            btnElement.style.border = '1px solid white'
          }
        }
    
        if(figCapElement){
          if(selectedElementId === id){
            figCapElement.style.overflow = 'unset'; 
            figCapElement.style.overflowWrap = 'break-word';
            figCapElement.style.webkitLineClamp = 'unset'
            figCapElement.style.zIndex = '1';
          }
        }
    }

    export const autoResize=(selectedElementId:number):void=> { //##
        const renameTxtBoxElmt = document.getElementById(`renameTxtBox${selectedElementId}`) as HTMLTextAreaElement;
        if(renameTxtBoxElmt){
        renameTxtBoxElmt.style.height = 'auto'; // Reset the height
        renameTxtBoxElmt.style.height = renameTxtBoxElmt.scrollHeight + 'px'; // Set new height
        }
    }

    export const showInvalidCharsToolTip=(selectedElementId:number):void=>{
        // get the position of the textbox
        const toolTipID = 'invalidChars';
        const invalidCharToolTipElement = document.getElementById(toolTipID) as HTMLElement;
        const renameContainerElement= document.getElementById(`renameContainer${selectedElementId}`) as HTMLElement;

        const rect = renameContainerElement.getBoundingClientRect();

        if(invalidCharToolTipElement){
            invalidCharToolTipElement.style.transform =`translate(${rect.x + 2}px, ${rect.y + 2}px)`;
            invalidCharToolTipElement.style.zIndex = '3';
            invalidCharToolTipElement.style.opacity = '1';
            invalidCharToolTipElement.style.transition = 'opacity 0.5s ease';
        }
    }

    export const hideInvalidCharsToolTip=():void=>{
        const toolTipID = 'invalidChars';
        const invalidCharToolTipElement = document.getElementById(toolTipID) as HTMLElement;

        if(invalidCharToolTipElement){
            invalidCharToolTipElement.style.transform =`translate(${-100000}px, ${100000}px)`;
            invalidCharToolTipElement.style.zIndex = '-1';
            invalidCharToolTipElement.style.opacity = '0';
            invalidCharToolTipElement.style.transition = 'opacity 0.5s ease 1';
        }
   }

    export const  setDivWithAndSize = (divElmnt:HTMLDivElement, initX:number, initY:number, width:number, height:number, isShow:boolean):void=>{
   
       divElmnt.style.position = 'absolute';
       divElmnt.style.transform =  `translate(${initX}px , ${initY}px)`;
       divElmnt.style.height =  `${height}px`;
       divElmnt.style.width =  `${width}px`;
   
       divElmnt.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
       divElmnt.style.border = '1px solid #047cd4';
       divElmnt.style.backdropFilter = 'blur(5px)';
       if(isShow){
            divElmnt.style.zIndex = '2';
            divElmnt.style.display =  'block';
        }else{
            divElmnt.style.zIndex = '0';
            divElmnt.style.display =  'none';
        }
    }

   export const  highlightSelectedItems= (initX: number, initY: number, width: number, height: number): void=>{
        const selectionRect = {
            left: initX,
            top: initY,
            right: initX + width,
            bottom: initY + height
        };

        const btnIcons = document.querySelectorAll('.desktopIcon-btn');
        btnIcons.forEach((btnIcon) => {
            const btnIconRect = btnIcon.getBoundingClientRect();

            // Check if the item is inside the selection area
            if ( btnIconRect.right > selectionRect.left && btnIconRect.left < selectionRect.right &&
                btnIconRect.bottom > selectionRect.top && btnIconRect.top < selectionRect.bottom){
                btnIcon.classList.add('desktopIcon-multi-select-highlight'); 
            } else {
                btnIcon.classList.remove('desktopIcon-multi-select-highlight');
            }
        });
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

}