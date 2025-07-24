import { CommonFunctions } from "./common.functions";
import { Constants } from "./constants";

export class FileInfo {
    private _IconPath!: string;
    private _currentPath!: string;
    private _contentPath!: string;
    private _contentBuffer!: ArrayBuffer | null;
    private _fileExtension!: string;
    private _fileType!: string;
    private _fileName!: string;
    private _opensWith!: string;
    private _dateAccessed!: Date;
    private _dateCreated!: Date;
    private _dateModified!: Date;
    private _size!: number;
    private _blkSize!: number;
    private _isFile!: boolean;
    private _isShortCut!: boolean;
    private _fileSizeUnit!: string;
    private _mode!: number;

    constructor() {
        this._IconPath = Constants.EMPTY_STRING;
        this._currentPath = Constants.EMPTY_STRING;
        this._contentPath = Constants.EMPTY_STRING;
        this._fileExtension = Constants.EMPTY_STRING;
        this._fileType = Constants.EMPTY_STRING;
        this._fileName = Constants.EMPTY_STRING;
        this._opensWith = Constants.EMPTY_STRING;
        this._dateModified = new Date('1990-01-01');
        this._dateCreated = new Date('1990-01-01');
        this._dateAccessed = new Date('1990-01-01');
        this._size = 0;
        this._blkSize = 0;
        this._isFile = true;
        this._isShortCut = false;
        this._fileSizeUnit = 'B';
        this._mode = 0;
        this._contentBuffer = null;
    }

    get getIconPath() {
        return this._IconPath;
    }
    set setIconPath(iconPath: string) {
        this._IconPath = iconPath;
    }

    get getCurrentPath() {
        return this._currentPath;
    }
    set setCurrentPath(currentPath: string) {
        this._currentPath = currentPath;
    }

    get getContentPath() {
        return this._contentPath;
    }
    set setContentPath(contentPath: string) {
        this._contentPath = contentPath;
    }

    get getFileExtension() {
        return this._fileExtension;
    }
    set setFileExtension(fileExtension: string) {
        this._fileExtension = fileExtension;
    }

    get getFileType() {
        return this._fileType;
    }
    set setFileType(fileType: string) {
        this._fileType = fileType;
    }

    get getFileName() {
        return this._fileName;
    }
    set setFileName(fileName: string) {
        this._fileName = fileName;
    }

    get getOpensWith() {
        return this._opensWith;
    }
    set setOpensWith(opensWith: string) {
        this._opensWith = opensWith;
    }

    get getDateModified() {
        return this._dateModified;
    }

    get getDateModifiedUS() {
        return this._dateModified.toLocaleString("en-US");
    }

    get getDateTimeModifiedUS() {
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return this._dateModified.toLocaleString("en-US", options).replace(Constants.COMMA, Constants.EMPTY_STRING);
    }

    set setDateModified(dateModified: string | Date) {
        this._dateModified = new Date(dateModified);
    }

    get getDateCreated() {
        return this._dateCreated;
    }
    set setDateCreated(dateCreated: string | Date) {
        this._dateCreated = new Date(dateCreated);
    }

    get getDateAccessed() {
        return this._dateAccessed;
    }
    set setDateAccessed(dateAccessed: string | Date) {
        this._dateAccessed = new Date(dateAccessed);
    }

    get getSizeInBytes() {
        return this._size;
    }

    get getSize() {
        return CommonFunctions.getReadableFileSizeValue(this._size);
    }

    set setSizeInBytes(size: number) {
        this._size = size;
    }

    get getBlkSizeInBytes() {
        return CommonFunctions.getReadableFileSizeValue(this._blkSize);
    }

    get getBlkSize() {
        return this._blkSize;
    }

    set setBlkSizeInBytes(blkSize: number) {
        this._blkSize = blkSize;
    }

    get getIsFile() {
        return this._isFile;
    }

    set setIsFile(isFile: boolean) {
        this._isFile = isFile;
    }

    get getIsShortCut() {
        return this._isShortCut;
    }

    set setIsShortCut(isShortCut: boolean) {
        this._isShortCut = isShortCut;
    }

    get getFileSizeUnit() {
        return CommonFunctions.getFileSizeUnit(this._size);
    }

    get getMode() {
        return '0' + (this._mode & parseInt('777', 8)).toString(8);
    }

    set setMode(mode: number) {
        this._mode = mode;
    }

    get getContentBuffer() {
        return this._contentBuffer;
    }

    set setContentBuffer(contentBuffer: ArrayBuffer) {
        this._contentBuffer = contentBuffer;
    }
}