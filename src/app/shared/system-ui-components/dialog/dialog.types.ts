
export namespace DialogTitle {
    export const placeholder = 'xyxyxyxy';
    export const placeholder2 = 'zqzqzqzq';
    export const placeholder3 = 'mpmpmpmp';

    export const FILE_SVC_FILE ='File';
    export const FILE_SVC_FOLDER ='Folder';

    export const FILE_SVC_DELETE_FILE = 'Delete file';
    export const FILE_SVC_DELETE_FOLDER = 'Delete folder';
    export const FILE_SVC_DELETE_CONFIRMATION = 'Delete Confirmation';
    export const FILE_SVC_DELETE_SHORTCUT = 'Delete Shortcut';
    export const FILE_SVC_DELETE_MULTIPLE_ITEMS = 'Delete Multiple Items';

    export const FILE_SVC_FILE_IN_USE = 'File in use';
    export const FILE_SVC_FOLDER_IN_USE = 'Folder in use';

    export const FILE_SVC_MOVE_FAILED = 'Move failed';
    export const FILE_SVC_MOVE_INCOMPLETE = 'Some files could not be moved';

    export const FILE_SVC_SHORTCUT = 'Shortcut';
    export const FILE_SVC_COPYING = 'Copying';
    export const FILE_SVC_MOVING = 'Moving';

    export const FILE_SVC_FOLDER_EXISTS= 'Folder Matching Name Present';
    export const FILE_SVC_PREPAIRING_TO_RECYCLE  = `Preparing to recycle:from:${placeholder}`;

    export const PROCESS_SVC_APP_NOT_FOUND = `C:/App Directory/${placeholder}`;
}


export namespace DialogMessage {
    export const placeholder = 'xyxyxyxy';
    export const placeholder1 = 'zqzqzqzq';
    export const placeholder2 = 'mpmpmpmp';
    export const placeholder3 = 'nmnmnmnm';

    export const FILE_SVC_PERMANENTLY_DELETE_FILE = 'Are you sure that you want to permanently delete this file?';
    export const FILE_SVC_PERMANENTLY_DELETE_FOLDER = 'Are you sure that you want to permanently delete this folder?';

    export const FILE_SVC_FILE_IN_USE = `The action can't be completed because the file is open in another program`;
    export const FILE_SVC_FOLDER_IN_USE = `The action can't be completed because the folder or a file in it is open in another program`;

    export const FILE_SVC_MOVE_FILE_TO_RECYCLE_BIN = 'Are you sure that you want to move this file to the Recycle Bin?';
    export const FILE_SVC_MOVE_FOLDER_TO_RECYCLE_BIN = 'Are you sure that you want to move this folder to the Recycle Bin?';

    export const FILE_SVC_SHORTCUT_CREATION_NOT_ALLOWED_IN_THIS_LOCATION = `Cheetah can't create a shortcut here.
Do you want the shortcut to be placed on the desktop instead?`;

    export const FILE_SVC_ESTIMATING='Estimating';

    export const TASKMANAGER_TERMINATE_PROCESS_NOT_ALLOWED = `The process '${placeholder}' can't be closed`;

    export const FILE_SVC_FOLDER_EXISTS = `Folder: ${placeholder}, already exists`;

    export const FILE_SVC_PREPAIRING_TO_RECYCLE  = `Discovered ${placeholder} items  (${placeholder1} ${placeholder2})...`;

    export const FILE_SVC_MOVE_INCOMPLETE_OR_FAILED = `${placeholder} of ${placeholder1} file(s) could not be moved: ${placeholder2}${placeholder3}.`;

    export const FILE_SVC_DELETE_MULTIPLE_ITEMS = `Are you sure you want to permanently delete these ${placeholder} items?`;

    export const SHUT_DOWN_CHEETAH = 'Shut Down Cheetah';

    export const PROCESS_SVC_APP_NOT_FOUND = `C:/App Directory/${placeholder}`;
}

// export enum DialogAction {
//     OK = 'OK',
//     CANCEL = 'Cancel',
//     YES = 'Yes',
//     NO = 'No',
//     CLOSE = 'Close',
//     RETRY = 'Retry',
//     ABORT = 'Abort',
//     IGNORE = 'Ignore'
// }

// export enum DialogResult {
//     OK = 'OK',
//     CANCEL = 'Cancel',      
// }

// export enum DialogType {
//     ALERT = 'ALERT',
//     CONFIRM = 'CONFIRM',
//     PROMPT = 'PROMPT',
//     CUSTOM = 'CUSTOM'
// }

// export enum DialogIcon {
//     INFO = 'INFO',
//     WARNING = 'WARNING',
//     ERROR = 'ERROR',
//     QUESTION = 'QUESTION'
// }

// export enum DialogSize {
//     SMALL = 'SMALL',
//     MEDIUM = 'MEDIUM',
//     LARGE = 'LARGE'
// }   

// export enum DialogPosition {
//     CENTER = 'CENTER',
//     TOP_LEFT = 'TOP_LEFT',
//     TOP_RIGHT = 'TOP_RIGHT',
//     BOTTOM_LEFT = 'BOTTOM_LEFT',
//     BOTTOM_RIGHT = 'BOTTOM_RIGHT'
// }   

// export enum DialogAnimation {
//     FADE = 'FADE',
//     SLIDE = 'SLIDE',
//     ZOOM = 'ZOOM',
//     NONE = 'NONE'
// }

// export enum DialogButtonStyle {
//     PRIMARY = 'PRIMARY',
//     SECONDARY = 'SECONDARY',
//     DANGER = 'DANGER',
//     SUCCESS = 'SUCCESS',
//     WARNING = 'WARNING'
// }   

// export enum DialogInputType {
//     TEXT = 'TEXT',
//     PASSWORD = 'PASSWORD',  
// }

// export enum DialogInputValidation {
//     NONE = 'NONE',
//     EMAIL = 'EMAIL',
//     NUMBER = 'NUMBER',
//     URL = 'URL',
//     CUSTOM = 'CUSTOM'
// }