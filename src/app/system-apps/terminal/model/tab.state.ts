export interface  IState{
    cursorPosition: number,
    isSectionActive:boolean,
    indexSection:number,
    indexIterCounter:number,
    path:string
}


export interface  ITabState2{
    tabSections:IState[]
}


export interface  ITabState{
    directories:string[],
    index: number,
    selected:string[], // Stores final selections
}
