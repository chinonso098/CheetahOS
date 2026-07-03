import { WindowState } from "src/app/shared/system-ui-components/window/windows.types";


interface BaseState{
    pId: number,
    appName:string
}

export interface AppState extends BaseState{
    appData:unknown,
    uId:string,
    window:WindowState,
}