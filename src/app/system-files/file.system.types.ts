export interface FileTransferUpdate {
    srcPath: string;
    destPath: string;
    totalNumberOfFiles: number;
    numberOfFilesCopied: number;
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
    signal: AbortSignal;
}
