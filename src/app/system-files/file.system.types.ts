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

export interface FileTransferOptions {
    arg0: string;
    srcPath: string;
    destPath: string;
    filesToTransferCount: number;
    dialogPId: number;
    fileTransferCount: FileTransferCount;
    initialSize:number;
    currentSize:number;
    signal: AbortSignal;
}
