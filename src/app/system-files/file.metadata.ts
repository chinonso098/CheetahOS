export class FileMetaData {
    private _accessDate: Date;
    private _createdDate: Date;
    private _modifiedDate: Date;
    private _size: number;
    private _blkSize: number;
    private _mode: number;
    private _isDirectory: boolean;

    constructor(
        accessDate: Date = new Date('1990-01-01'),
        createdDate: Date = new Date('1990-01-01'),
        modifiedDate: Date = new Date('1990-01-01'),
        size = 0,
        blkSize = 0,
        mode = 0,
        isDir = false ) {
        this._createdDate = createdDate;
        this._modifiedDate = modifiedDate;
        this._accessDate = accessDate;
        this._size = size;
        this._blkSize = blkSize;
        this._mode = mode;
        this._isDirectory = isDir;
    }

    get getCreatedDate(): Date {
        return this._createdDate;
    }
    set setCreatedDate(date: string | Date) {
        this._createdDate = new Date(date);
    }

    get getModifiedDate(): Date {
        return this._modifiedDate;
    }
    set setModifiedDate(date: string | Date) {
        this._modifiedDate = new Date(date);
    }

    get getAccessDate(): Date {
        return this._accessDate;
    }
    set setAccessDate(date: string | Date) {
        this._accessDate = new Date(date);
    }

    get getSize(): number {
        return this._size;
    }
    set setSize(size: number) {
        this._size = size;
    }

    get getBlkSize(): number {
        return this._blkSize;
    }
    set setBlkSize(blkSize: number) {
        this._blkSize = blkSize;
    }

    get getMode(): number {
        return this._mode;
    }
    set setMode(mode: number) {
        this._mode = mode;
    }

    get getIsDirectory(): boolean {
        return this._isDirectory;
    }
    set setIsDirectory(isDir: boolean) {
        this._isDirectory = isDir;
    }
}
