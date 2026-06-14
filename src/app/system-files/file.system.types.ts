import { FileInfo } from "./file.info";

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

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export interface FileTransferCopyOptions {
    arg0: string;
    srcPath: string;
    destPath: string;
    filesToTransferCount: number;
    dialogPId: number;
    fileTransferCount: FileTransferCount;
    currentSize:number;
    signal: AbortSignal;
    limiter?: Limiter;
}

export interface FolderMoveQueueItem {
    src: string;
    parentDest: string;
    isRoot?: boolean;
}

export interface FileStat{ isDirectory: boolean; size: number; exists: boolean }

export interface FileTransferMoveOptions {
    // Per-folder queue: each item carries its own parent destination so siblings
    // are not mistakenly treated as nested folders.
    folderToProcessingQueue: FolderMoveQueueItem[];
    folderToDeleteStack: string[];
    filesToMoveCount: number;
    dialogPId: number;
    filesMovedCount: FileTransferCount;
    currentSize:number;
    signal: AbortSignal;
    isRecycleBin?: boolean;
    moveFolderItself?: boolean; // true = move folder, false = move only contents
    limiter?: Limiter;
}

export interface FileOperationCheck {
    file: FileInfo;
    callerUId?: string;
    skipConfirmDialog?: boolean;
}
