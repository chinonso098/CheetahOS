import { FileService } from "src/app/shared/system-service/file.service";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/file.info";
import { mousePosition } from "./desktop.types";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DesktopIconAlignmentHelper {

  let cloneList:HTMLElement[] = []
  let cloneIdList:number[] = []

  const cloneDesktopIcon = (id: number): HTMLElement=> {
    const srcIconElmnt = document.getElementById(`iconBtn${id}`) as HTMLElement;
    // Clone the element deeply
    return srcIconElmnt.cloneNode(true) as HTMLElement;
  }

  // export const preCloneDesktopIcons = (btnIds: number[]):void=>{
  //   btnIds.forEach(btnId =>{
  //     if(!cloneIdList.includes(btnId)){
  //       const btnClone = cloneDesktopIcon(btnId);
  //       cloneList.push(btnClone);
  //       cloneIdList.push(btnId);
  //     }
  //   });
  // }

  export const preCloneDesktopIcon = (btnId: number):void=>{
    if(!cloneIdList.includes(btnId)){
      const btnClone = cloneDesktopIcon(btnId);
      cloneList.push(btnClone);
      cloneIdList.push(btnId);
    }
  }

  export const clearPreClonedIcons = ():void=>{  cloneList = []}

  export const clearPreClonedIconById = (id:number):void=>{


    //const deleteCount = 1;
    const idx = cloneIdList.findIndex(x => x === id);
    cloneIdList = cloneIdList.filter((_, index) => index !== idx);
    cloneList = cloneList.filter((_, index) => index !== idx);

    console.log('What is in cloneList:', cloneList);

    // if(idx !== -1){
    //   cloneIdList = cloneIdList.splice(idx, deleteCount);
    //   cloneList = cloneList.splice(idx, deleteCount);
    // }
  }
  
  export const  handleDragStart = (evt:DragEvent, 
      i: number, 
      countOfMarkedBtns: number, 
      markedBtnIds: string[],
      files:FileInfo[],
      fileService: FileService ): number =>{
    
      // Get the cloneIcon container
      const elementId = 'desktopIcon_clone_cntnr';
      const cloneIcon = document.getElementById(elementId);

      let counter = 0;
      let draggedElementId = -1;
  
      if(cloneIcon){
        //Clear any previous content in the clone container
        cloneIcon.innerHTML = Constants.EMPTY_STRING;
        if(countOfMarkedBtns <= 1){
          draggedElementId = i;

          // const srcIconElmnt = document.getElementById(`iconBtn${i}`) as HTMLElement;
          // cloneIcon.appendChild(srcIconElmnt.cloneNode(true));
  
          cloneList.forEach(clone =>{
            cloneIcon.appendChild(clone);
          });

          // Move it out of view initially
          cloneIcon.style.left = '-9999px';  
          cloneIcon.style.opacity = '0.2';
  
          const file = files[i];
          if(file)
            fileService.addDragAndDropFile(file);
      
          // Set the cloned icon as the drag image
          if (evt.dataTransfer) {
            evt.dataTransfer.setDragImage(cloneIcon, 0, 0);  // Offset positions for the drag image
          }
        }else{
          markedBtnIds.forEach(id =>{
            const srcIconElmnt = document.getElementById(`iconBtn${id}`) as HTMLElement;
            const spaceDiv = document.createElement('div');
  
            // Add create an empty div that will be used for spacing between each cloned icon
            spaceDiv.setAttribute('id', `spacediv${id}`);
            spaceDiv.style.transform =  'translate(0, 0)';
            spaceDiv.style.width =  'fit-content';
            spaceDiv.style.height =  '20px';
  
            //cloneIcon.appendChild(srcIconElmnt.cloneNode(true));
            console.log('What is in cloneList:', cloneList);
            cloneIcon.appendChild(cloneList[Number(id)])
            if(counter !== countOfMarkedBtns - 1)
              cloneIcon.appendChild(spaceDiv);
  
            counter++;
  
            const file = files[Number(id)];
            if(file)
              fileService.addDragAndDropFile(file);
          });
  
          cloneIcon.style.left = '-9999px';  // Move it out of view initially
          cloneIcon.style.opacity = '0.2';
  
          // Set the cloned icon as the drag image
          if (evt.dataTransfer) {
            evt.dataTransfer.setDragImage(cloneIcon, 0, 0);  // Offset positions for the drag image
          }
        }
      }

    return draggedElementId;
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
          const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`) as HTMLElement;

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

  export const handleMoveBtnIconsToNewPositionAlignOn = (mPos: mousePosition,
      movedBtnIds: string[],  
      markedBtnIds: string[], 
      draggedElementId:number,
      GRID_SIZE:number,
      ROW_GAP:number ): string[] => {

    const gridEl = document.getElementById('desktopIcon_ol') as HTMLElement;
    const heightAdjustment = 20;
    const iconWidth = GRID_SIZE; 
    const iconHeight = GRID_SIZE - heightAdjustment;  

    if (!gridEl) return [];

    const rect = gridEl.getBoundingClientRect();
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
        const btnIconElmnt = document.getElementById(`desktopIcon_li${id}`) as HTMLElement;
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

  export const correctMisalignedIcons =(movedBtnIds: string[], GRID_SIZE:number, ROW_GAP:number ): void=> {

    const heightAdjustment = 20;
    const iconWidth = GRID_SIZE;
    const iconHeight = GRID_SIZE - heightAdjustment
    const rowGap = ROW_GAP; 
    const effectiveRowHeight = iconHeight + rowGap; 
    const offsetY = 5;

    const grid = document.getElementById('desktopIcon_ol');
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();

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