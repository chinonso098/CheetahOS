export interface GeneralMenu {
    icon:string;
    label: string;
    action: () => void;
}

export interface NestedMenu{
    icon1: string; 
    icon2: string; 
    label: string; 
    nest: NestedMenuItem[]; 
    action: () => void; 
    action1: () => void; 
    emptyline: boolean; 
}

export interface NestedMenuItem {
    icon:string;
    label: string;
    action: () => void;
    variables?: boolean;
    emptyline:boolean;
    styleOption:string;
}