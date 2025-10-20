import { Constants } from "src/app/system-files/constants";
import { IconsSizesPX, ShortCutIconsSizes, ShortCutIconsBottom, IconsSizes } from "./desktop.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopStyleHelper {

    export const removeBtnStyle =(id:number):void =>{
        const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
        const figCapElement = document.getElementById(`figCap${id}`) as HTMLElement;

        if(btnElement){
            if(btnElement.classList.contains('desktopIcon-multi-select-highlight'))
                btnElement.classList.remove('desktopIcon-multi-select-highlight');

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

            if(!btnElement.classList.contains('desktopIcon-multi-select-highlight'))
                btnElement.classList.add('desktopIcon-multi-select-highlight'); 
    
            if(selectedElementId === id){
                (isMouseHover)
                ? btnElement.style.backgroundColor ='#607c9c' 
                : btnElement.style.backgroundColor = 'hsl(206deg 77% 70%/20%)';
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

    export const setMultiSelectStyleOnBtn = (id:number,  isMouseHover:boolean):void =>{
        const btnElement = document.getElementById(`iconBtn${id}`) as HTMLElement;
        if(btnElement){
          if(!isMouseHover){
            btnElement.style.backgroundColor = 'rgba(0, 150, 255, 0.3)';
            btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';
          }else{
            btnElement.style.backgroundColor = '#607c9c';
            btnElement.style.borderColor = 'hsla(0,0%,50%,25%)';
          }
        }
    }

    export const changeMainDkstpBkgrndColor = (color: string): void=> {
        const mainElmnt = document.getElementById('vantaCntnr') as HTMLElement;
        if (mainElmnt) {
          mainElmnt.style.backgroundColor = color;
        }
      }

    export const handleChangeIconsSize = (iconSize:string, 
        GRID_SIZE:number, 
        MIN_GRID_SIZE:number, 
        MID_GRID_SIZE:number, 
        MAX_GRID_SIZE:number
    ):Record<string, unknown>[] =>{

        let iconSizeStyle:Record<string, unknown> = {};
        let shortCutIconSizeStyle:Record<string, unknown> = {};
        let figCapIconSizeStyle:Record<string, unknown> = {};

        const iconsSizes:number[][] = [[IconsSizesPX.SMALL_ICONS, ShortCutIconsSizes.SMALL_ICONS, ShortCutIconsBottom.SMALL_ICONS], 
                                       [IconsSizesPX.MEDIUM_ICONS, ShortCutIconsSizes.MEDIUM_ICONS, ShortCutIconsBottom.MEDIUM_ICONS], 
                                       [IconsSizesPX.LARGE_ICONS, ShortCutIconsSizes.LARGE_ICONS, ShortCutIconsBottom.LARGE_ICONS]];
    
        const size = (iconSize === IconsSizes.SMALL_ICONS) ? iconsSizes[0] :
                     (iconSize === IconsSizes.MEDIUM_ICONS) ? iconsSizes[1] :
                     iconsSizes[2];
    
        GRID_SIZE = (iconSize === IconsSizes.SMALL_ICONS) ? MIN_GRID_SIZE :
                    (iconSize === IconsSizes.MEDIUM_ICONS) ? MID_GRID_SIZE :
                    MAX_GRID_SIZE;
    
        iconSizeStyle = {
          'width': `${size[0]}px`, 
          'height': `${size[0]}px`,
        }
        shortCutIconSizeStyle = {
          'width': `${size[1]}px`, 
          'height': `${size[1]}px`,
          'bottom': `${size[2]}px`
        }
        figCapIconSizeStyle ={
          'width': `${GRID_SIZE}px`, 
        }

        return [iconSizeStyle, shortCutIconSizeStyle, figCapIconSizeStyle]
    }

    export const  handleChangeGridRowColSize = (
        GRID_SIZE:number, 
        ROW_GAP:number,
        MIN_GRID_SIZE:number, 
        MID_GRID_SIZE:number, 
        MAX_GRID_SIZE:number
    ):Record<string, unknown> =>{

        let btnStyle:Record<string, unknown> = {};

        const rowSpace  = ROW_GAP; //row space of 25px between each icons
    
        const colSize = (GRID_SIZE === MAX_GRID_SIZE) ? MAX_GRID_SIZE :
                        (GRID_SIZE === MID_GRID_SIZE) ? MID_GRID_SIZE :
                        MIN_GRID_SIZE;
    
        const rowSize = (GRID_SIZE === MAX_GRID_SIZE)? (MAX_GRID_SIZE - rowSpace) :
                        (GRID_SIZE === MID_GRID_SIZE)? (MID_GRID_SIZE - rowSpace) :
                        (MIN_GRID_SIZE - rowSpace);
    
        const dsktpmngrOlElmnt = document.getElementById('desktopIcon_ol') as HTMLElement;
        if(dsktpmngrOlElmnt){
          dsktpmngrOlElmnt.style.gridTemplateColumns = `repeat(auto-fill, ${colSize}px)`;
          dsktpmngrOlElmnt.style.gridTemplateRows = `repeat(auto-fill,${rowSize}px)`;
        }
    
        return btnStyle = {
          'width': `${colSize}px`, 
          'height': 'min-content',
          // 'height': `${rowSize}px`,
        }
    }

}
