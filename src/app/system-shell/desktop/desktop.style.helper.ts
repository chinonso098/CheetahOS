import { Constants } from "src/app/system-files/constants";
import { IconsSizesPX, ShortCutIconsSizes, ShortCutIconsBottom, IconsSizes } from "./desktop.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopStyleHelper {

    export const removeBtnStyle =(id:number):void =>{
        // §1.5 — dropped redundant `as HTMLElement` casts.
        // `document.getElementById` already returns `HTMLElement | null`.
        const btnElement = document.getElementById(`iconBtn${id}`);
        const figCapElement = document.getElementById(`figCap${id}`);

        if(!btnElement || !figCapElement) return;

        if(btnElement.classList.contains('desktopIcon-multi-select-highlight'))
            btnElement.classList.remove('desktopIcon-multi-select-highlight');

        btnElement.style.backgroundColor = Constants.EMPTY_STRING;
        btnElement.style.borderColor = Constants.EMPTY_STRING;
    
        figCapElement.style.overflow = 'hidden'; 
        figCapElement.style.overflowWrap = 'unset'
        figCapElement.style.webkitLineClamp = '2';
        figCapElement.style.zIndex = 'unset';
        figCapElement.style.removeProperty('display');
    }

    export const  setBtnStyle =(id:number, isMouseHover:boolean, selectedElementId:number, isIconInFocusDueToPriorAction:boolean):void =>{

        // §1.5 — dropped redundant `as HTMLElement` casts.
        const btnElement = document.getElementById(`iconBtn${id}`);
        const figCapElement = document.getElementById(`figCap${id}`);

        if(!btnElement || !figCapElement) return;

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

        if(selectedElementId === id){
            figCapElement.style.overflow = 'unset'; 
            figCapElement.style.overflowWrap = 'break-word';
            figCapElement.style.webkitLineClamp = 'unset'
            figCapElement.style.zIndex = '1';
        }
    
    }

    /**
     * §1.4 — `invalidCharsToolTip` is the singleton tooltip element
     * (`<div id="invalidChars">`) supplied by the caller via the
     * component's `@ViewChild` ElementRef.  The per-icon
     * `renameContainer${selectedElementId}` lookup remains as a
     * `document.getElementById` call — it's a Category B (per-icon)
     * lookup and out of scope for the §1.4 singletons-only pass.
     */
    export const showInvalidCharsToolTip=(selectedElementId:number, invalidCharsToolTip: HTMLElement | null):void=>{
        // get the position of the textbox.
        // §1.5 — dropped redundant `as HTMLElement` cast and added a
        // null guard so the latent crash-if-not-yet-rendered case can't
        // throw `Cannot read properties of null (reading 'getBoundingClientRect')`.
        const renameContainerElement = document.getElementById(`renameContainer${selectedElementId}`);
        if (!renameContainerElement) return;

        const rect = renameContainerElement.getBoundingClientRect();

        if(invalidCharsToolTip){
            invalidCharsToolTip.style.transform =`translate(${rect.x + 2}px, ${rect.y + 2}px)`;
            invalidCharsToolTip.style.zIndex = '3';
            invalidCharsToolTip.style.opacity = '1';
            invalidCharsToolTip.style.transition = 'opacity 0.5s ease';
        }
    }

    /**
     * §1.4 — `invalidCharsToolTip` supplied by the caller via the
     * component's `@ViewChild` ElementRef.
     */
    export const hideInvalidCharsToolTip=(invalidCharsToolTip: HTMLElement | null):void=>{
        if(invalidCharsToolTip){
            invalidCharsToolTip.style.transform =`translate(${-100000}px, ${100000}px)`;
            invalidCharsToolTip.style.zIndex = '-1';
            invalidCharsToolTip.style.opacity = '0';
            invalidCharsToolTip.style.transition = 'opacity 0.5s ease 1';
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

    export const  highlightSelectedItems= (
        initX: number, initY: number, width: number, height: number,
        // §3.A — caller (DesktopIconsHandler.activateMultiSelect)
        // snapshots `.desktopIcon-btn` ONCE per lasso and passes the
        // same list to every per-pixel call.  The previous shape did
        // its own `document.querySelectorAll('.desktopIcon-btn')` on
        // every mousemove tick — with ~50 icons that's 50 layout
        // reads per pixel.
        btnIcons: ReadonlyArray<HTMLElement>,
    ): void=>{
        const selectionRect = {
            left: initX,
            top: initY,
            right: initX + width,
            bottom: initY + height
        };

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
        // §1.5 — dropped redundant `as HTMLElement` cast.
        const btnElement = document.getElementById(`iconBtn${id}`);
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

    /**
     * §1.4 — `vantaCntnr` (desktop root, `<main id="vantaCntnr">`)
     * supplied by the caller via the component's `@ViewChild` ElementRef.
     */
    export const changeMainDkstpBkgrndColor = (color: string, vantaCntnr: HTMLElement | null): void=> {
        if (vantaCntnr) {
          vantaCntnr.style.backgroundColor = color;
        }
      }

    // §1.5 — `iconSize` tightened from `string` to `IconsSizes`.  The
    // function body already compares against `IconsSizes.*` members,
    // and the sole caller (`DesktopIconsHandler.changeIconsSize`) now
    // also passes the enum.
    export const handleChangeIconsSize = (iconSize: IconsSizes,
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

    /**
     * §1.4 — `desktopIconOl` (the icon-grid `<ol>` container) supplied
     * by the caller via the component's `@ViewChild` ElementRef.
     */
    export const  handleChangeGridRowColSize = (
        GRID_SIZE:number, 
        ROW_GAP:number,
        MIN_GRID_SIZE:number, 
        MID_GRID_SIZE:number, 
        MAX_GRID_SIZE:number,
        desktopIconOl: HTMLElement | null,
    ):Record<string, unknown> =>{

        let btnStyle:Record<string, unknown> = {};

        const rowSpace  = ROW_GAP; //row space of 25px between each icons
    
        const colSize = (GRID_SIZE === MAX_GRID_SIZE) ? MAX_GRID_SIZE :
                        (GRID_SIZE === MID_GRID_SIZE) ? MID_GRID_SIZE :
                        MIN_GRID_SIZE;
    
        const rowSize = (GRID_SIZE === MAX_GRID_SIZE)? (MAX_GRID_SIZE - rowSpace) :
                        (GRID_SIZE === MID_GRID_SIZE)? (MID_GRID_SIZE - rowSpace) :
                        (MIN_GRID_SIZE - rowSpace);
    
        if(desktopIconOl){
          desktopIconOl.style.gridTemplateColumns = `repeat(auto-fill, ${colSize}px)`;
          desktopIconOl.style.gridTemplateRows = `repeat(auto-fill,${rowSize}px)`;
        }
    
        return btnStyle = {
          'width': `${colSize}px`, 
          'height': 'min-content',
          // 'height': `${rowSize}px`,
        }
    }

}
