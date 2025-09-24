export enum SortBys { 
    NAME = 'Name',
    DATE_MODIFIED = 'Date Modified',
    ITEM_TYPE = 'Item Type', 
    SIZE = 'Size',
}

export enum UserNotificationType {
    Error = "Error",
    Info = "Info",
    Warning = "Warning",
    PowerOnOff = "ShutdownRestart",
    FileTransfer = "FileTransfer",
}

export enum FileIndexIDs { 
    // FILE = 'FILE',
    APPS = 'APPS',
    DOCUMENTS = 'DOCUMENTS', 
    FOLDERS = 'FOLDERS',
    MUSIC = 'MUSIC',
    PHOTOS = 'PHOTOS',
    VIDEOS = 'VIDEOS',
}

export enum fileIndexChangeOperationType { 
    ADD = 'ADD',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
}

export enum ActivityType { 
    FILE = 'FILE',
    FOLDERS = 'FOLDERS',
    APPS = 'APPS',
}

export enum ComponentType {
    System = "System",
    User = "User",
}

export enum ProcessType {
    Background = "Background process",
    Cheetah = "Cheetah process",
    App = "App",
}