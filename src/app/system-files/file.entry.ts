export class FileEntry{
    private _name:string;
    private _path:string;

    constructor(){
        this._path = '';
        this._name = '';
    }

    get getPath(){
        return this._path;
    }
    set setPath(path:string){
         this._path = path;
    }

    get getName(){
        return this._name;
    }
    set setName(name:string){
        this._name = name
    }
}
