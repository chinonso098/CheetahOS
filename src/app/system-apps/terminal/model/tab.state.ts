export interface  IState{
    cursorPosition: number,
    isSectionActive:boolean,
    indexSection:number,
    dirEntryTraverseCntr:number,
    currentPath:string
}

export interface  ITabState{
    sections:IState[]
}