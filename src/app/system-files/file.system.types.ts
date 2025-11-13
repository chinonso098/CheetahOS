export interface FileTransferUpdate {
    srcPath: string;
    destPath: string;
    totalNumberOfFiles: number;
    numberOfFilesCopied: number;
    timeRemaining:number;
    itemsRemaining:number;
    itemsRemainingSize:number;
    fileName: string;
}

export interface FileTransferCount{ fileCount: number; }

export interface FileTransferCopyOptions {
    arg0: string;
    srcPath: string;
    destPath: string;
    filesToTransferCount: number;
    dialogPId: number;
    fileTransferCount: FileTransferCount;
    currentSize:number;
    signal: AbortSignal;
}

export interface FileTransferMoveOptions {
    destPath: string;
    folderToProcessingQueue: string[];
    folderToDeleteStack: string[];
    filesToMoveCount: number;
    dialogPId: number;
    filesMovedCount: FileTransferCount;
    currentSize:number;
    signal: AbortSignal;
    isRecycleBin?: boolean;
    moveFolderItself?: boolean; // true = move folder, false = move only contents
    skipCounter?: number;
}
