import { Constants } from "./constants";

/**
 * AppDirectory
 * ------------
 * Lightweight, in-memory catalogue of every application the OS knows how to launch.
 *
 * Responsibilities:
 *  - Hold the canonical list of installed apps (system apps + user apps).
 *  - Answer "does this app exist?" lookups.
 *  - Resolve an app name to its desktop/taskbar icon path.
 *
 * The data here is static configuration (no I/O), so the source lists and the
 * icon lookup table are declared once rather than being rebuilt on the fly.
 */
export class AppDirectory {

    /**
     * Built-in applications that ship with the system.
     * Order is not significant — callers look apps up by name, not by index.
     */
    private readonly _systemProcessList: string[] = [
        "audioplayer", "chatter", "cheetah", "clippy", "clipboard", "fileexplorer",
        "taskmanager", "terminal", "videoplayer", "photoviewer",
        "runsystem", "texteditor", "settings", "screensaverviewer", "snippingtool"
    ];

    /**
     * Optional / user-installed applications.
     */
    private readonly _userProcessList: string[] = [
        "hello", "greeting", "jsdos", "ruffle", "codeeditor",
        "markdownviewer", "starfield", "boids", "particleflow", "pdfviewer"
    ];

    /**
     * The complete, de-duplicated catalogue of app names (system apps first,
     * then user apps). Built once in the constructor.
     */
    private readonly _processList: string[];

    private _hiddenApps:string[] = ['cheetah', 'clippy', 'hello', 'runsystem', 'clipboard','greeting', 'screensaverviewer']

    /**
     * Maps an app name to its icon file name (relative to `Constants.IMAGE_BASE_PATH`).
     *
     * Declared `static readonly` so the table is created a single time and shared
     * by every instance instead of being rebuilt on each `getAppIcon` call, and
     * provides O(1) lookups via `Map.get`.
     *
     * Apps without an entry here (e.g. "clippy", "hello", "greeting") have no
     * dedicated icon asset and intentionally fall back to the generic icon below.
     */
    private static readonly _appIconMap: ReadonlyMap<string, string> = new Map<string, string>([
        ["audioplayer", "audioplayer.png"],
        ["chatter", "chatter.png"],
        ["cheetah", "cheetah.png"],
        ["clipboard", "clipboard.png"],
        ["settings", "settings.png"],
        ["fileexplorer", "file_explorer.png"],
        ["taskmanager", "taskmanager.png"],
        ["terminal", "terminal.png"],
        ["videoplayer", "videoplayer.png"],
        ["photoviewer", "photoviewer.png"],
        ["snippingtool", "snip_tool.png"],
        ["runsystem", "run.png"],
        ["texteditor", "quill.png"],
        ["jsdos", "js-dos_emulator.png"],
        ["ruffle", "ruffle.png"],
        ["codeeditor", "vs_code.png"],
        ["markdownviewer", "markdown.png"],
        ["starfield", "star_field.png"],
        ["screensaverviewer", "scrn_saver.png"],
        ["boids", "bird_oid.png"],
        ["particleflow", "particles.png"],
        ["pdfviewer", "pdf_js.png"],
        ["runsystem", "run.png"]
    ]);

    /** Icon used when an app has no dedicated entry in `_appIconMap`. */
    private static readonly _defaultIcon = "generic_program.png";

    constructor() {
        // Merge the two source lists into a single catalogue, dropping any
        // accidental duplicates while preserving order (system apps first).
        // De-duplicating keeps `getAppPosition`/`indexOf` unambiguous.
        this._processList = [...new Set([...this._systemProcessList, ...this._userProcessList])];
    }

    /**
     * Returns true when `appName` is a known application.
     */
    public appExist(appName: string): boolean {
        const name = appName.trim();
        return this._processList.includes(name);
    }

    /**
     * Returns the zero-based position of `appName` in the catalogue,
     * or -1 when the app is unknown.
     */
    // public getAppPosition(appName: string): number {
    //     return this._processList.indexOf(appName);
    // }

    /**
     * Returns the full catalogue of known app names.
     */
    public getAppList(): string[] {
        return this._processList;
    }

    /**
     *get hidden apps list
     */
    public getHiddenApp(): string[] {
        return this._hiddenApps;
    }

    /**
     * Resolves the full icon path for `appName`, falling back to the generic
     * program icon when the app has no dedicated icon.
     */
    public getAppIcon(appName: string): string {
        const iconFile = AppDirectory._appIconMap.get(appName) ?? AppDirectory._defaultIcon;
        return `${Constants.IMAGE_BASE_PATH}${iconFile}`;
    }
}
