import { MenuPosition, GeneralMenu } from "src/app/shared/system-component/menu/menu.types";
import { DefaultService } from "src/app/shared/system-service/defaults.services";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopContextMenuHelper {
    export const checkAndHandleDesktopCntxtMenuBounds =(evt:MouseEvent, menuHeightInput:number, menuWidthInput:number):[MenuPosition, boolean] =>{
        let xAxis = 0;
        let yAxis = 0;
        const menuWidth = menuWidthInput;
        const menuHeight = menuHeightInput;
        const subMenuWidth = 205;
        const taskBarHeight = 40;

        let isShiftSubMenuLeft = false;
    
        const mainWindow = document.getElementById('vantaCntnr');
        const windowWidth =  mainWindow?.offsetWidth || 0;
        const windowHeight =  mainWindow?.offsetHeight || 0;
    
        const horizontalDiff =  windowWidth - evt.clientX;
        const verticalDiff = windowHeight - evt.clientY;
    
        let horizontalShift = false;
        let verticalShift = false;
    
        if((horizontalDiff) < menuWidth){
          horizontalShift = true;
          const diff = menuWidth - horizontalDiff;
          xAxis = evt.clientX - diff;
        }
    
        if((horizontalDiff) < (menuWidth + subMenuWidth)){
          //this.isShiftSubMenuLeft = true;
          isShiftSubMenuLeft = true;
        }
    
        if((verticalDiff) >= taskBarHeight && (verticalDiff) <= menuHeight){
          const shifMenuUpBy = menuHeight - verticalDiff;
          verticalShift = true;
          yAxis = evt.clientY - shifMenuUpBy - taskBarHeight;
        }
        
        xAxis = (horizontalShift)? xAxis : evt.clientX;
        yAxis = (verticalShift)? yAxis : evt.clientY;
     
        return [{xAxis, yAxis}, isShiftSubMenuLeft];
    }

    export const adjustIconContextMenuData =(file:FileInfo, sourceData: GeneralMenu[], defaultService:DefaultService): [GeneralMenu[], string]=>{
        let menuData = [];
        let menuOrder = Constants.EMPTY_STRING;
        if(file.getIsFile){
            //files can not be opened in terminal, pinned to start, opened in new window, or pin to Quick access
            menuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
            for(const x of sourceData) {
              if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || 
                 x.label === 'Pin to Start' || x.label === 'Empty Recycle Bin' || 
                 x.label === 'Confirm Delete' || x.label === 'Recycle on Delete'){ /*nothing*/}
              else{
                menuData.push(x);
              }
            }
        }else{
          if(file.getCurrentPath === Constants.RECYCLE_BIN_PATH){ 
            const showDelete = getConfirmDeleteState(Constants.DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG, defaultService);
            const moveToRecycle = getConfirmDeleteState(Constants.DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE, defaultService);
            menuOrder = Constants.RECYCLE_BIN_MENU_ORDER;
            for(const x of sourceData){
              if(x.label === 'Open' || x.label === 'Empty Recycle Bin' || x.label === 'Create shortcut' ||
                 x.label === 'Confirm Delete' || x.label === 'Recycle on Delete'){ 
                  
                if(x.label === 'Confirm Delete')
                  x.icon = (showDelete)? `${Constants.IMAGE_BASE_PATH}chkmark32.png` : Constants.EMPTY_STRING;

                if(x.label === 'Recycle on Delete')
                  x.icon = (moveToRecycle)? `${Constants.IMAGE_BASE_PATH}chkmark32.png` : Constants.EMPTY_STRING;
                
                menuData.push(x);
              }
            }
          }else{
            menuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
            menuData = sourceData.filter(x => x.label !== 'Empty Recycle Bin')
            .filter(x => x.label !== 'Confirm Delete')
            .filter(x => x.label !== 'Recycle on Delete');
          }
        }

        return [menuData, menuOrder]
    }

    const getConfirmDeleteState =(setting:string, defaultService:DefaultService):boolean=>{
      const confirmationState = defaultService.getDefaultSetting(setting);
      return confirmationState === (Constants.TRUE)? true : false;
    }

    export const  checkAndHandleDesktopIconCntxtMenuBounds =(evt:MouseEvent, menuHeight:number):MenuPosition =>{
        let yAxis = 0;
        let verticalShift = false;
    
        const xAxis = 0;
        const taskBarHeight = 40;
        const mainWindow = document.getElementById('vantaCntnr');
        const windowHeight =  mainWindow?.offsetHeight || 0;
        const verticalSum = evt.clientY + menuHeight;
    
        if(verticalSum >= windowHeight || (windowHeight - verticalSum) <= 40){
          verticalShift = true;
          const shifMenuUpBy = verticalSum - windowHeight;
          yAxis = evt.clientY - (shifMenuUpBy + taskBarHeight);
        }
    
        if(!verticalShift){
          yAxis = evt.clientY;
        }
    
        return {xAxis, yAxis};
    }
}