import { Constants } from "src/app/system-files/constants";
import { ScreenshotSetting } from "./settings.interface";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace SettingsHelper {

    /**
     * Splits a stored "type:value" setting on its FIRST colon only.
     *
     * Unlike String.prototype.split(':'), this keeps any additional colons that
     * belong to the value intact (e.g. a future URL such as "Picture:http://...")
     * and always returns a fixed two-element tuple, so callers can safely
     * destructure [type, value] without worrying about a missing second element.
     *
     * @param raw The raw stored setting, e.g. "Picture:osdrive/.../crown.jpg".
     * @returns A [type, value] tuple; value is an empty string when no colon exists.
     */
    export const splitSettingValue = (raw:string):[string, string] =>{
        const separatorIdx = raw.indexOf(Constants.COLON);
        if(separatorIdx === -1)
            return [raw, Constants.EMPTY_STRING];

        const type = raw.substring(0, separatorIdx);
        const value = raw.substring(separatorIdx + 1);
        return [type, value];
    }

    export const generateDesktopPictureOptions =(desktopBkgrndOption:string):string[] =>{
        const options:string[] = [];
        const desktopImgPath = Constants.DESKTOP_IMAGE_BASE_PATH;
        const isDyanmicBkgrnd = (desktopBkgrndOption === Constants.BACKGROUND_DYNAMIC) ? true : false;
    
        const desktopImages = (isDyanmicBkgrnd)
        ? Constants.DESKTOP_DYNAMIC_PICTURE_SET
        : Constants.DESKTOP_PICTURE_SET;
    
        desktopImages.forEach( imgName =>{ options.push(`${desktopImgPath}${imgName}`) });
        return options;
    }

    export const generateLockScreenPictureOptions =():string[] =>{
        const options:string[] = [];
        const lockScreenImgPath = Constants.LOCK_SCREEN_IMAGE_BASE_PATH;
        const lockScreenImages = Constants.LOCKSCREEN_PICTURE_SET;
    
        lockScreenImages.forEach( imgName =>{ options.push(`${lockScreenImgPath}${imgName}`) });
        return options;
    }

    export const  getFalseForeGroundScreenShot =(color: string): string =>{
        const dsktpCntnrElmnt = document.getElementById('vantaCntnr') as HTMLElement;
    
        const canvas = document.createElement('canvas');
        canvas.width = dsktpCntnrElmnt.offsetWidth;
        canvas.height = dsktpCntnrElmnt.offsetHeight;
    
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      
        const dataUrl = canvas.toDataURL('image/png');
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
    
        // const link = document.createElement('a');
        // link.download = 'test-img.png';
        // link.href = dataUrl;
        // link.click();
      
        return dataUrl;
    }

    export const getDefaultScreenShot=():ScreenshotSetting =>{
        return{ 
            imgPath: Constants.EMPTY_STRING, 
            isImage:false,
            colorValue:Constants.EMPTY_STRING,
            isColor:false,
            onlyBackGround:true, 
            onlyForeGround:false,
            useVantaCanvas:false,
            mergeImage:false,
            changeBackGrndColor:false
        }
    }
      
    export const changeMainDkstpBkgrndColor =(color: string): void =>{
        const mainElmnt = document.getElementById('vantaCntnr') as HTMLElement;
        if (!mainElmnt) return;

        mainElmnt.style.backgroundColor = color;
    }

    export const  updateTime=():string =>{
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        //const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12; // Convert 24-hour to 12-hour format
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    
       return`${formattedHours}:${formattedMinutes}`;
      }
    
      export const getDate=():string =>{
        const now = new Date();
        return now.toLocaleString('en-US', {
          weekday: 'long', // Full day name (e.g., "Tuesday")
          month:'long',
          day:'numeric'
        });
      }
    
}