export interface FileSystemUpdateInfo {
    srcPath: string;
    destPath: string;
    totalNumberOfFiles: number;
    numberOfFilesCopied: number;
    fileName: string;
}

export interface FilesCopiedCount{ fileCount: number; }

export interface CopyFolderOptions {
    arg0: string;
    srcPath: string;
    destPath: string;
    fileCount: number;
    dialogPId: number;
    copiedFiles: FilesCopiedCount;
    signal: AbortSignal;
}
