import { ElementRef } from "@angular/core";
import { ClampedPosition, WindowPositionInfo, WindowState } from "./windows.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace WindowHelper {

    export const  getDesktopRect =():DOMRect | undefined => {
      const el = document.getElementById('vantaCntnr') as HTMLElement | null;
      return el ? el.getBoundingClientRect() : undefined;
    }

    export const clamp = (n: number, min: number, max: number):number=> {
      return Math.max(min, Math.min(max, n));
    }

    export const computeClampedPosition =(leftPx: number, topPx: number, width: number, height: number, taskBarHeightPx:number): ClampedPosition | undefined =>{
      const desktop = WindowHelper.getDesktopRect();

      if(!desktop){
        console.warn('Computing clamped position failed, desktop is undefined');
         return;
      }
      const maxLeft = Math.max(0, desktop.width - width);
      const maxTop  = Math.max(0, desktop.height - taskBarHeightPx - height);

      return {
        leftPx: WindowHelper.clamp(leftPx, 0, maxLeft),
        topPx: WindowHelper.clamp(topPx, 0, maxTop),
      };
    }

    export const clampToContainer = (secondaryWindowContainer:ElementRef, windowLeftPx:number, windowTopPx:number, 
      edgePadPx:number,taskBarHeightPx:number): WindowPositionInfo | undefined => {
        
      const desktop = WindowHelper.getDesktopRect();
      const winEl = secondaryWindowContainer?.nativeElement as HTMLElement | undefined;
      if (!desktop || !winEl) return;

      const winRect = winEl.getBoundingClientRect();
      const pad = edgePadPx;

      const maxLeft = Math.max(pad, desktop.width - winRect.width - pad);
      const maxTop  = Math.max(pad, desktop.height - taskBarHeightPx - winRect.height - pad);

      const winLeftPx = Math.min(Math.max(windowLeftPx, pad), maxLeft);
      const winTopPx  = Math.min(Math.max(windowTopPx, pad), maxTop);

      return {pId:0, leftPx:winLeftPx, topPx:winTopPx};
    }

    /**
     * Pure: copies the supplied position/size/z-index fields onto `state`.
     *
     * No service lookup, no service write -- that's the caller's job. This
     * makes the helper trivially testable (pass a plain object, assert
     * fields) and keeps the WindowService dependency out of the helper
     * namespace.
     *
     * `zIndex` is accepted as a string for convenience because components
     * already hold the CSS-formatted value; we Number() it here so callers
     * don't have to remember.
     */
    export const applyPositionSize = (state: WindowState, windowLeftPx: number, windowTopPx: number,
        windowWidthPx: number, windowHeightPx: number, windowZIndex: string): void => {
      state.leftPx   = windowLeftPx;
      state.topPx    = windowTopPx;
      state.widthPx  = windowWidthPx;
      state.heightPx = windowHeightPx;
      state.zIndex   = Number(windowZIndex);
    }

    export const  setFocusOnDiv =(winCmpntId:string):void =>{
      const winCmpnt = document.getElementById(winCmpntId) as HTMLDivElement;

      if(!winCmpnt) return;
      
      winCmpnt.focus();
    }

}