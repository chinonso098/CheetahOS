import { WindowState } from "src/app/shared/system-component/window/windows.types";

interface BaseState{
    pid: number,
    app_name:string
}

export interface AppState extends BaseState{
    app_data:unknown,
    unique_id:string,
    window:WindowState,
}