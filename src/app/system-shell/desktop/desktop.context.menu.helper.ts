
import { MenuPosition, GeneralMenu } from "src/app/shared/system-ui-components/menu/menu.types";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/fs/file.info";
import { RecycleBinToggleState } from "./desktop.types";
import { MenuAction } from "src/app/shared/system-ui-components/menu/menu.enums";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopContextMenuHelper {
   /**
    * §1.4 — the desktop root element (`<main id="vantaCntnr">`) is now
    * passed in by the caller via the component's `@ViewChild` ElementRef
    * instead of being looked up here with `document.getElementById`.
    * Keeps this helper pure (no DOM globals beyond its arguments).
    */
   export const checkAndHandleDesktopCntxtMenuBounds =(evt:MouseEvent, menuHeightInput:number, menuWidthInput:number, vantaCntnr: HTMLElement | null):[MenuPosition, boolean] =>{
        let xAxis = 0;
        let yAxis = 0;
        const menuWidth = menuWidthInput;
        const menuHeight = menuHeightInput;
        const subMenuWidth = 205;
        const taskBarHeight = 40;

        let isShiftSubMenuLeft = false;
    
        const windowWidth =  vantaCntnr?.offsetWidth || 0;
        const windowHeight =  vantaCntnr?.offsetHeight || 0;
    
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

    /**
     * Filters / re-orders the icon context menu rows based on whether the
     * icon points at a file, the recycle-bin folder, or a regular folder.
     *
     * Recycle-bin toggle state (`showDelete`, `moveToRecycle`) is supplied
     * pre-computed by the caller — this helper never touches `DefaultService`.
     */
    export const adjustIconContextMenuData =(file:FileInfo, sourceData: GeneralMenu[], recycleBinState: RecycleBinToggleState): [GeneralMenu[], string]=>{
        const { showDelete, moveToRecycle } = recycleBinState;
        const checkIcon = `${Constants.IMAGE_BASE_PATH}chkmark32.png`;
        const specialCaseUrlName = 'About';

        // --- File: full menu minus rows that only apply to folders / the bin ---
        if(file.getIsFile){
            // A file can't be opened in terminal, pinned, or carry recycle-bin toggles.
            const excluded = new Set<string>([MenuAction.OPEN_IN_TERMINAL, MenuAction.PIN_TO_QUICK_ACCESS, MenuAction.PIN_TO_START,
                MenuAction.EMPTY_RECYCLE_BIN, MenuAction.CONFIRM_DELETE, MenuAction.RECYCLE_ON_DELETE]);
            // "Open with..." is hidden for URL shortcuts, shown for every other file.
            const isUrl = file.getFileExtension === Constants.URL || file.getFileType === Constants.URL;

            const menuData = sourceData.filter(x =>
                !excluded.has(x.label) && !(x.label === MenuAction.OPEN_WITH && isUrl));

            if(file.getFileExtension === Constants.URL && file.getFileName === specialCaseUrlName){
              const filterdMenuData = menuData.filter(x => x.label === MenuAction.OPEN);
              return [filterdMenuData, Constants.DEFAULT_FILE_MENU_ORDER];
            }
            else
              return [menuData, Constants.DEFAULT_FILE_MENU_ORDER];
        }

        // --- Recycle Bin folder: keep only the bin-specific rows ---
        if(file.getCurrentPath === Constants.RECYCLE_BIN_PATH){
          // Allow-list: every other row (incl. "Open with...") is dropped.
          const allowed = new Set<string>([MenuAction.OPEN, MenuAction.EMPTY_RECYCLE_BIN,  MenuAction.CONFIRM_DELETE, MenuAction.RECYCLE_ON_DELETE]);
          const menuData = sourceData.filter(x => allowed.has(x.label));

          // Reflect the current toggle state with a checkmark (or none).
          for(const x of menuData){
            if(x.label === MenuAction.CONFIRM_DELETE)
                x.icon = showDelete ? checkIcon : Constants.EMPTY_STRING;
            else if(x.label === MenuAction.RECYCLE_ON_DELETE)
                x.icon = moveToRecycle ? checkIcon : Constants.EMPTY_STRING;
          }

          return [menuData, Constants.RECYCLE_BIN_MENU_ORDER];
        }

        // --- Regular folder: drop file-/bin-only rows ---
        const excluded = new Set<string>([MenuAction.EMPTY_RECYCLE_BIN, MenuAction.OPEN_WITH, MenuAction.CONFIRM_DELETE, MenuAction.RECYCLE_ON_DELETE, MenuAction.PIN_TO_TASKBAR]);
        const menuData = sourceData.filter(x => !excluded.has(x.label));

        return [menuData, Constants.DEFAULT_FOLDER_MENU_ORDER];
    }

    /**
     * §1.4 — the desktop root element is now passed in by the caller
     * via the component's `@ViewChild` ElementRef instead of being
     * looked up here with `document.getElementById`.
     */
    export const  checkAndHandleDesktopIconCntxtMenuBounds =(evt:MouseEvent, menuHeight:number, vantaCntnr: HTMLElement | null):MenuPosition =>{
      let yAxis = 0;
      let verticalShift = false;
  
      const xAxis = 0;
      const taskBarHeight = 40;
      const windowHeight =  vantaCntnr?.offsetHeight || 0;
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