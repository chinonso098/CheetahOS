export interface GeneralMenu {
    icon: string;
    label: string;
    action: () => void;
}

/**
 * A menu item that displays a checkmark reflecting an on/off state. Used by
 * the "checkable" menu variant (e.g. the Task Manager's show/hide-columns
 * menu). Clicking the item runs `action`, which is expected to flip the
 * underlying state and update `checked` so the next render shows the new value.
 */
export interface CheckableMenu {
    label: string;
    checked: boolean;
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
    icon: string;
    label: string;
    action: (event: MouseEvent) => void;
    variables?: boolean;
    emptyline: boolean;
    styleOption: string;
}

export interface MenuPosition{ 
    xAxis: number; 
    yAxis: number; 
}