export interface mousePosition{
    clientX:number,
    clientY:number,
    offsetX:number,
    offsetY:number,
    x: number,
    y: number,
}

export enum IconsSizes { 
    LARGE_ICONS = 'Large Icons',  
    MEDIUM_ICONS = 'Medium Icons',  
    SMALL_ICONS = 'Small Icons',  
}

export enum IconsSizesPX { 
    LARGE_ICONS = 80,  
    MEDIUM_ICONS = 45,  
    SMALL_ICONS = 30,  
}

export enum ShortCutIconsSizes { 
    LARGE_ICONS = 21,  
    MEDIUM_ICONS = 12,  
    SMALL_ICONS = 8,  
}

export enum ShortCutIconsBottom { 
    LARGE_ICONS = 1,  
    MEDIUM_ICONS = -8,  
    SMALL_ICONS = -12,  
}