export interface ScreenshotSetting{
    imgPath: string,
    isImage:boolean,
    colorValue: string, 
    isColor:boolean
    onlyBackGround:boolean, 
    onlyForeGround:boolean, 
    useVantaCanvas:boolean, 
    mergeImage : boolean,
    changeBackGrndColor: boolean
}

/**
 * A single clickable entry in one of the settings navigation panels
 * (home grid, system list, personalization list).
 *
 * Replaces the previous `string[][]` ("magic index") representation so the
 * template can read `option.icon` / `option.title` instead of `option[0]` / `option[1]`.
 */
export interface SettingsMenuOption{
    /** Path to the option's icon image. */
    icon: string,
    /** Display text; also used as the selection key passed to the click handlers. */
    title: string,
    /** Optional secondary description (only the home grid uses this). */
    subtitle?: string
}