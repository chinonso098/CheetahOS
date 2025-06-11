
export interface BaseState{
    pid: number,
    app_name:string
}


export interface WindowState extends BaseState{
    width:number,
    height:number,
    x_axis:number,
    y_axis:number,
    z_index:number,
    is_visible:boolean,
}


export interface AppState extends BaseState{
    app_data:unknown,
    unique_id:string,
}


export interface AppSessionData extends BaseState{
    app_data:unknown,
    unique_id:string,
    window:WindowState,
}