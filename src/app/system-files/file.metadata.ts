export class FileMetaData{
    private _createdDate:Date;
    private _modifiedDate:Date;
    private _size:number;
    private _mode:number;

    constructor(createdDate:Date = new Date('1990-01-01'), modifiedDate:Date = new Date('1990-01-01'), size = 0 , mode = 0){
        this._createdDate = createdDate;
        this._modifiedDate = modifiedDate;
        this._size = size;
        this._mode = mode;
    }

    get getCreatedDate(){
        return this._createdDate;
    }
    set setCreatedDate(date:string){
        this._createdDate = new Date(date);
    }
    get getModifiedDate(){
        return this._modifiedDate;
    }
    set setModifiedDate(date:string){
        this._modifiedDate = new Date(date);
    }

    get getSize(){
        return this._size;
    }
    set setSize(size:number){
         this._size = size;
    }

    get getMode(){
        return this._mode;
    }
    set setMode(mode:number){
        this._mode = mode;
    }

}


export interface FolderSizeMeta {
    totalSize: number;
    fileCount: number;
    folderCount: number;
    errors: string[];
}
