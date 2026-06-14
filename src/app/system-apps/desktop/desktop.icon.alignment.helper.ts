import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";
import { DragStartResult, mousePosition } from "./desktop.types";


// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopIconAlignmentHelper {

  let cloneList:HTMLElement[] = []
  let cloneIdList:number[] = []

  /**
   * §1.5 — returns `null` when the source icon hasn't rendered yet
   * instead of crashing inside `.cloneNode(true)`.  Caller bails on
   * null rather than enqueuing a broken clone.
   */
  const cloneDesktopIcon = (id: number): HTMLElement | null => {
    const srcIconElmnt = document.getElementById(`iconBtn${id}`);
    if (!srcIconElmnt) return null;
    // Clone the element deeply.  `cloneNode(true)` returns `Node`, so the
    // `as HTMLElement` cast survives — it's the one cast we can't drop.
    return srcIconElmnt.cloneNode(true) as HTMLElement;
  }

  export const preCloneDesktopIcon = (btnId: number):void=>{
    if(!cloneIdList.includes(btnId)){
      const btnClone = cloneDesktopIcon(btnId);
      // §1.5 — skip enqueue when the source icon hasn't rendered yet.
      if (!btnClone) return;
      cloneList.push(btnClone);
      cloneIdList.push(btnId);
    }
  }

  //export const clearPreClonedIcons = ():void=>{  cloneList = []}

  /**
   * Drop one icon's tracking entries (clone element + id) from the
   * pre-clone bookkeeping.  No-op when the id was never staged.
   *
   * §3.E — was a 2-pass operation: `findIndex` to locate, then TWO
   * `filter((_, i) => i !== idx)` calls (one per array) to remove.
   * Now ONE pass each: locate the index ONCE, then `splice` in place
   * on both arrays so a missing id triggers no allocation at all.
   * Using `splice` (in place) over a fresh `filter` allocation is
   * fine here because these arrays are private to the helper.
   */
  export const clearPreClonedIconById = (id:number):void=>{
    const idx = cloneIdList.indexOf(id);
    if (idx === -1) return;
    cloneIdList.splice(idx, 1);
    cloneList.splice(idx, 1);
  }
  
  /**
   * Builds the drag-image clone container and reports the dragged-element id
   * plus the list of files that should be staged in `FileService` as the
   * drag payload.  The caller is responsible for calling
   * `FileService.addDragAndDropFile(...)` on each — this helper never
   * touches application services.
   *
   * §1.4 — `desktopIconCloneCntnr` is the off-screen scratch container
   * (`<div id="desktopIcon_clone_cntnr">`) supplied by the caller via
   * the component's `@ViewChild` ElementRef.
   */
  export const  handleDragStart = (evt:DragEvent, 
      i: number, 
      countOfMarkedBtns: number, 
      files:FileInfo[],
      desktopIconCloneCntnr: HTMLElement | null): DragStartResult =>{
    
      let draggedElementId = -1;
      const filesToRegister: FileInfo[] = [];
  
      if(desktopIconCloneCntnr){
        //Clear any previous content in the clone container
        desktopIconCloneCntnr.innerHTML = Constants.EMPTY_STRING;
        if(countOfMarkedBtns <= 1){
          draggedElementId = i;
  
          cloneList.forEach(clone =>{ desktopIconCloneCntnr.appendChild(clone);  });
          const file = files[i];
          if(file)
            filesToRegister.push(file);
          
        }else{
          cloneIdList.forEach(id =>{
            const file = files[id];
            if(file)
              filesToRegister.push(file);
          });

          cloneList.forEach((clone, idx) =>{
            desktopIconCloneCntnr.appendChild(clone);
            if(idx !== countOfMarkedBtns - 1){
              const spacer = document.createElement('div');
              spacer.style.height = '20px';
              desktopIconCloneCntnr.appendChild(spacer);
            }
          });
        }

        // Move it out of view initially
        desktopIconCloneCntnr.style.left = '-9999px';
        // §4-followup — REMOVED `desktopIconCloneCntnr.style.opacity = '0.2'`.
        // Every browser already applies its own ~50% translucency to
        // the drag image as a native UX cue (Windows, macOS — see the
        // HTML5 drag-and-drop spec).  Stacking our extra 0.2 on top
        // multiplied to ~10% effective opacity, which the user
        // perceived as "barely visible" specifically on multi-select
        // drag (a tall stack of faint clones reads much worse than a
        // single faint icon).  Letting the browser-native
        // translucency be the only translucency restores normal
        // visibility for multi-select while leaving single-icon drag
        // visually unchanged.
        //
        // `left: -9999px` is kept: the container still needs to be
        // out of the viewport so the live page doesn't briefly show
        // it before `setDragImage` snapshots it.

        // Set the cloned icon as the drag image
        if(evt.dataTransfer){
          evt.dataTransfer.setDragImage(desktopIconCloneCntnr, 0, 0);  // Offset positions for the drag image
        }
      }

    return { draggedElementId, filesToRegister };
  }

  /**
   * §1.4 — `desktopIconCloneCntnr` supplied by the caller via the
   * component's `@ViewChild` ElementRef.
   */
  export const clearCloneContainer = (desktopIconCloneCntnr: HTMLElement | null): void =>{
    if(desktopIconCloneCntnr) 
      desktopIconCloneCntnr.innerHTML = Constants.EMPTY_STRING;
  }

  export const  handleMoveBtnIconsToNewPositionAlignOff = (mPos:mousePosition, 
      movedBtnIds: string[],  
      markedBtnIds: string[], 
      draggedElementId:number,
      GRID_SIZE:number ):string[] =>{

      let counter = 0;
      let justAdded = false;

      if(markedBtnIds.length === 0){
          justAdded = true;
          markedBtnIds.push(String(draggedElementId));
      }

      markedBtnIds.forEach(id =>{
          // §1.5 — dropped redundant `as HTMLElement` cast.
          const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`);

          movedBtnIds.push(id);
          if(btnIconElmnt){
              const btnIconRect = btnIconElmnt.getBoundingClientRect();
              const xDiff = mPos.x - btnIconRect.left;
              const newX = btnIconRect.left + xDiff;

              let newY = 0;
              if(counter === 0)
                  newY = mPos.y;
              else{
              const yDiff = btnIconRect.top - mPos.y;
              const product = (GRID_SIZE * counter);
              newY = btnIconRect.top - yDiff + product;
              }

              btnIconElmnt.style.position = 'absolute';
              btnIconElmnt.style.transform = `translate(${Math.abs(newX)}px, ${Math.abs(newY)}px)`;
          }
          counter++;
      });

      if(justAdded)
          markedBtnIds.pop();

      return markedBtnIds;
  }

  /**
   * §1.4 — `desktopIconOl` (the icon-grid `<ol>`) is supplied by the
   * caller via the component's `@ViewChild` ElementRef.
   */
  export const handleMoveBtnIconsToNewPositionAlignOn = (mPos: mousePosition,
      movedBtnIds: string[],  
      markedBtnIds: string[], 
      draggedElementId:number,
      GRID_SIZE:number,
      ROW_GAP:number,
      desktopIconOl: HTMLElement | null ): string[] => {

    const heightAdjustment = 20;
    const iconWidth = GRID_SIZE; 
    const iconHeight = GRID_SIZE - heightAdjustment;  

    if (!desktopIconOl) return [];

    const rect = desktopIconOl.getBoundingClientRect();
    const relativeX = mPos.x - rect.left;
    const relativeY = mPos.y - rect.top;

    const effectiveRowHeight = iconHeight + ROW_GAP;

    let counter = 0;
    let justAdded = false;

    if (markedBtnIds.length === 0) {
        justAdded = true;
        markedBtnIds.push(String(draggedElementId));
    }

    markedBtnIds.forEach(id => {
        // §1.5 — dropped redundant `as HTMLElement` cast.
        const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`);
        movedBtnIds.push(id);
    
        if (btnIconElmnt) {
            // Calculate grid position (1-based index for CSS Grid)
            const col = Math.floor(relativeX / iconWidth) + 1;
            const row = Math.floor(relativeY / effectiveRowHeight) + 1 + counter;
    
            btnIconElmnt.style.removeProperty('position');
            btnIconElmnt.style.removeProperty('transform');
            btnIconElmnt.style.setProperty('--grid-col', col.toString());
            btnIconElmnt.style.setProperty('--grid-row', row.toString());
            btnIconElmnt.style.gridColumn = `var(--grid-col)`;
            btnIconElmnt.style.gridRow = `var(--grid-row)`;
        }
    
        counter++;
    });

    if(justAdded) 
        markedBtnIds.pop();
    
    return  markedBtnIds;
  }

  /**
   * §1.4 — `desktopIconOl` is supplied by the caller via the
   * component's `@ViewChild` ElementRef.
   */
  export const correctMisalignedIcons =(movedBtnIds: string[], GRID_SIZE:number, ROW_GAP:number, desktopIconOl: HTMLElement | null ): void=> {

    const heightAdjustment = 20;
    const iconWidth = GRID_SIZE;
    const iconHeight = GRID_SIZE - heightAdjustment
    const rowGap = ROW_GAP; 
    const effectiveRowHeight = iconHeight + rowGap; 
    const offsetY = 5;

    if (!desktopIconOl) return;

    const gridRect = desktopIconOl.getBoundingClientRect();

    movedBtnIds.forEach((id) => {
      const btnIcon = document.getElementById(`desktopIcon_li${id}`);
      if (!btnIcon) return;

      const iconRect = btnIcon.getBoundingClientRect();

      // Convert to coordinates relative to the grid container
      const relativeLeft = iconRect.left - gridRect.left;
      const relativeTop = iconRect.top - gridRect.top;

      // Snap to nearest column and row
      const correctedX = Math.round(relativeLeft / iconWidth) * iconWidth;
      const correctedY = Math.round(relativeTop / effectiveRowHeight) * effectiveRowHeight;

      // Apply corrected transform (positioning within grid)
      btnIcon.style.position = 'absolute';
      btnIcon.style.transform = `translate(${correctedX}px, ${correctedY + offsetY}px)`;
    });
  }

}