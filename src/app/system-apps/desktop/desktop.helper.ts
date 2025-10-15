import { GeneralMenu, MenuPosition } from "src/app/shared/system-component/menu/menu.types";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopHelper {


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
    

    export const adjustIconContextMenuData =(file:FileInfo, sourceData: GeneralMenu[]): [GeneralMenu[], string]=>{
        let menuData = [];
        let menuOrder = Constants.EMPTY_STRING;
        if(file.getIsFile){
            //files can not be opened in terminal, pinned to start, opened in new window, or pin to Quick access
            menuOrder = Constants.DEFAULT_FILE_MENU_ORDER;
            for(const x of sourceData) {
              if(x.label === 'Open in Terminal' || x.label === 'Pin to Quick access' || x.label === 'Pin to Start' || x.label === 'Empty Recycle Bin'){ /*nothing*/}
              else{
                menuData.push(x);
              }
            }
        }else{
          if(file.getCurrentPath === Constants.RECYCLE_BIN_PATH){ 
            menuOrder = Constants.RECYCLE_BIN_MENU_ORDER;
            for(const x of sourceData){
              if(x.label === 'Open' || x.label === 'Empty Recycle Bin' || x.label === 'Create shortcut'){ 
                menuData.push(x);
              }
            }
          }else{
            menuOrder = Constants.DEFAULT_FOLDER_MENU_ORDER;
            menuData = sourceData.filter(x => x.label !== 'Empty Recycle Bin');
          }
        }

        return [menuData, menuOrder]
    }
      

    export const  checkAndHandleDesktopIconCntxtMenuBounds =(evt:MouseEvent, menuHeight:number):MenuPosition =>{
        let yAxis = 0;
        let verticalShift = false;
    
        const xAxis = 0;
        const taskBarHeight = 40;
        const mainWindow = document.getElementById('vantaCntnr');
        const windowHeight =  mainWindow?.offsetHeight || 0;
        const verticalSum = evt.clientY + menuHeight;
    
        console.log('verticalSum:', verticalSum);
    
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

}