export enum ViewOptions { 
    LIST_VIEW = 'List View',
    CONTENT_VIEW = 'Content View',
    DETAILS_VIEW = 'Details View',
    TILES_VIEW = 'Tiles View',
    SMALL_ICON_VIEW = 'Small Icon View',
    MEDIUM_ICON_VIEW = 'Medium Icon View',
    LARGE_ICON_VIEW = 'Large Icon View',
    EXTRA_LARGE_ICON_VIEW = 'Extra Large Icon View',
}

export enum ViewOptionsCSS{
    ICONS_VIEW_CSS = 'ol-iconview-grid', 
    LIST_VIEW_CSS ='ol-listview-grid', 
    DETAILS_VIEW_CSS ='ol-detailsview-grid', 
    TITLES_VIEW_CSS ='ol-tilesview-grid', 
    CONTENT_VIEW_CSS ='ol-contentview-grid'
}

export interface FileToolTip{
    label:string;
    data:string;
}

