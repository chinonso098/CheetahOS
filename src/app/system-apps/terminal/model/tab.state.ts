export interface  IState{
    cursorPosition: number,
    indexSection:number,
    dirEntryTraverseCntr:number,
    currentPath:string
}

export interface  ITabState{
    sections:IState[]
}