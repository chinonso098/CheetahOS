export class FileContent{
    private _iconPath:string;
    private _fileName:string;
    private _fileType:string;
    private _contentPath:string;
    private _opensWith:string;

    constructor(IconPath:string, FileName:string, FileType:string, ContentPath:string, OpensWith:string){
        this._iconPath = IconPath;
        this._fileName = FileName;
        this._fileType = FileType;
        this._contentPath = ContentPath;
        this._opensWith = OpensWith;
    }

    get getIconPath(){
        return this._iconPath;
    }
    set setIconPath(iconFile:string){
        this._iconPath = iconFile;
    }

    get geFileName(){
        return this._fileName;
    }
    set setFileName(fileName:string){
        this._fileName = fileName
    }

    get getContentPath(){
        return this._contentPath;
    }
    set setContentPath(contentUrl:string){
        this._contentPath = contentUrl
    }

    get getFileType(){
        return this._fileType;
    }
    set setFileType(fileType:string){
        this._fileType = fileType
    }

    get getOpensWith(){
        return this._opensWith;
    }
    set setOpensWith(opensWith:string){
        this._opensWith = opensWith
    }

}