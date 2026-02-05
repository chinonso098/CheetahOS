import { WindowState } from "src/app/shared/system-component/primarywindow/windows.types";

interface BaseState{
    pId: number,
    appName:string
}

export interface AppState extends BaseState{
    appData:unknown,
    uId:string,
    window:WindowState,
}