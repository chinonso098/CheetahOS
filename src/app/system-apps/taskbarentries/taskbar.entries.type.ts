/**
 * Two display modes the taskbar can be in:
 *  - 'merged'   : one icon per application (Win11-style), instance count is shown by a pill.
 *  - 'unmerged' : one icon per *running window* (Win-7 style with labels).
 *
 * Centralising the literal strings here removes the magic-string comparisons
 * (`x === Constants.MERGED_TASKBAR_ENTRIES`) sprinkled through the component and
 * lets the compiler catch typos in `if` branches.
 */
export type TaskbarMode = 'merged' | 'unmerged';

export interface TaskBarIconInfo{
    pId:number,
    uId:string,
    iconPath:string,
    defaultIconPath:string,
    opensWith:string,
    appName:string,
    displayName:string
    showLabel:string,
    isRunning:boolean,
    isPinned:boolean,
    isOtherPinned:boolean,
    instanceCount:number,
    /**
     * True when this icon represents the currently focused window.
     * Drives the focused-window background highlight purely via template binding
     * (no more `document.getElementById(...).style.backgroundColor = ...`).
     */
    isFocused:boolean,
    /**
     * True while a process is in a "transfer" state (file copy/move). Drives the
     * animated shine overlay (`.transfer_lighting` class) without DOM mutation.
     */
    isTransferActive:boolean
}

export interface TooltipPositionInfo{
    left: number; 
    top: number; 
    appName:string
}

export interface TaskBarPreviewPositionInfo{
    rect:DOMRect;
    iconPath:string,
    appName:string,
}

export interface IconAppCurrentState{
    showLabel:string,
    isRunning:boolean
}

export interface RectLite { 
    left: number; 
    top: number; 
    width: number; 
    height: number; 
    right: number
}