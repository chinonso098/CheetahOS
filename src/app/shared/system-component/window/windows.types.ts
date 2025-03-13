export interface WindowState{
    pid: number,
    app_name:string
    width:number,
    height:number,
    x_axis:number,
    y_axis:number,
    z_index:number,
    is_visible:boolean,
}


export interface WindowBoundsState{
    x_offset: number,
    y_offset: number,
    y_bounds_subtraction:number,
    x_bounds_subtraction:number,
}