import { ElementRef, Renderer2 } from "@angular/core";
import { Constants } from "src/app/system-files/constants";
import { WindowConstants } from "./window.constants";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace WindowStyleHelper {

    type State = {
      glassPaneContainer: ElementRef<HTMLElement> | null;
      renderer: Renderer2 | null;
      windowLeftPx: number;
      windowTopPx: number;
      windowHeightPx:number;
      windowWidthPx:number
      uniqueGlassPaneId: string;
    };

    const state: State = {
      glassPaneContainer: null,
      renderer: null,
      windowLeftPx: 0,
      windowTopPx: 0,
      windowHeightPx: 0,
      windowWidthPx: 0,
      uniqueGlassPaneId: Constants.EMPTY_STRING,
    };

    /* Updates the helper's internal variables.
    * - Only updates fields you pass (partial update).
    * - Use this from your component whenever these values change.
    */
    export const updateState = (patch: Partial<State>): void => {
      if (patch.glassPaneContainer !== undefined) state.glassPaneContainer = patch.glassPaneContainer ?? null;
      if (patch.renderer !== undefined) state.renderer = patch.renderer ?? null;

      if (patch.windowLeftPx !== undefined) state.windowLeftPx = Number.isFinite(patch.windowLeftPx) ? patch.windowLeftPx : 0;
      if (patch.windowTopPx !== undefined) state.windowTopPx = Number.isFinite(patch.windowTopPx) ? patch.windowTopPx : 0;
      if (patch.windowHeightPx !== undefined) state.windowHeightPx = Number.isFinite(patch.windowHeightPx) ? patch.windowHeightPx : 0;
      if (patch.windowWidthPx !== undefined) state.windowWidthPx = Number.isFinite(patch.windowWidthPx) ? patch.windowWidthPx : 0;

      if (patch.uniqueGlassPaneId !== undefined) state.uniqueGlassPaneId = patch.uniqueGlassPaneId ?? Constants.EMPTY_STRING;
    };

    export const applyStyle = (inputStyle:Record<string, unknown>, windowLeftPx:number, windowTopPx:number,
        zIndex: number, opacity: number, isVisible:boolean = true):Record<string, unknown> => {
          
      const style= {
        ...inputStyle,
        left: `${windowLeftPx}px`,
        top: `${windowTopPx}px`,
        transform: isVisible ? 'translate(0, 0)' : 'translate(0, 0) scale(1)',
        'z-index': zIndex,
        opacity
      };

      return style;
    }

    export const createSilhouette= (uniqueGlassPaneId:string, renderer: Renderer2, glassPaneContainer: ElementRef<HTMLElement> , windowHeightPx:number, windowWidthPx:number):ElementRef<HTMLElement> =>{
      //Every window has a hidden glass pane that is revealed when the window is hidden
      const glassPane = renderer.createElement('div');

      // Add attributes
      glassPane.setAttribute('id', uniqueGlassPaneId);
      glassPane.style.transform =  'translate(0, 0)';
      glassPane.style.height =  `${windowHeightPx}px`;
      glassPane.style.width =  `${windowWidthPx}px`;

      glassPane.style.zIndex =  String(WindowConstants.HIDDEN_Z_INDEX);
      glassPane.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
      glassPane.style.backdropFilter = 'blur(2px)';
      glassPane.style.display =  'none';

      // Append to the body
      renderer.appendChild(glassPaneContainer.nativeElement, glassPane);
      return glassPaneContainer;
    }

    export const showSilhouette =(): void=>{
      WindowStyleHelper.showGlassPaneContainer();

      const glassPane = document.getElementById(state.uniqueGlassPaneId) as HTMLDivElement;
      if (!glassPane)return;

      glassPane.style.display = 'block';
      glassPane.style.zIndex = String(WindowConstants.MIN_Z_INDEX);
      WindowStyleHelper.positionSilhouette();
    }

    export const positionSilhouette =():void =>{
      const glassPane = document.getElementById(state.uniqueGlassPaneId) as HTMLDivElement;
      if (!glassPane) return;

      glassPane.style.position = 'absolute';
      glassPane.style.left = `${state.windowLeftPx}px`;
      glassPane.style.top = `${state.windowTopPx}px`;
      glassPane.style.transform = 'translate(0px, 0px)';
    }

    export const showGlassPaneContainer = ():void=>{
      if(!state.renderer || !state.glassPaneContainer) return;

      state.renderer.setStyle(state.glassPaneContainer.nativeElement, 'display', 'block');
    }

    export const hideSilhouette =():void=>{
      WindowStyleHelper.hideGlassPaneContainer();

      const glassPane= document.getElementById(state.uniqueGlassPaneId) as HTMLDivElement;
      if(!glassPane) return;

      glassPane.style.display = 'none';
      glassPane.style.zIndex = String(WindowConstants.HIDDEN_Z_INDEX);
    }

    export const hideGlassPaneContainer =():void=> {
      if(!state.renderer || !state.glassPaneContainer) return;

      state.renderer.setStyle(state.glassPaneContainer.nativeElement, 'display', 'none');
    }

    export const removeSilhouette = ():void =>{

      const glassPane= document.getElementById(state.uniqueGlassPaneId) as HTMLDivElement;
      if (!glassPane) return;

      glassPane.remove();
    }

    export const syncSilhouetteSize =():void=>{
      const glassPane = document.getElementById(state.uniqueGlassPaneId) as HTMLDivElement | null;
      if (!glassPane) return;
      
      glassPane.style.width = `${state.windowWidthPx}px`;
      glassPane.style.height = `${state.windowHeightPx}px`;
    }
}