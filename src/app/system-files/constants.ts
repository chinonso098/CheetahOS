// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Constants{

    export const EMPTY_STRING = '';
    export const BLANK_SPACE = ' ';
    export const ROOT = '/';
    export const COLON = ':';
    export const COMMA = ',';
    export const DOT = '.';
    export const DOUBLE_DOT = '..';
    export const BACK_TICK= '`';
    export const TILDE= '~';
    export const DASH= '-';
    export const BACK_SLASH= '\\';
    export const DOUBLE_SLASH = '//';
    export const NEW_LINE = '\n';
    export const OSDISK = 'OSDisk (C:)';
    export const THISPC = 'This PC';
    export const RECYCLE_BIN = 'Recycle Bin';
    export const URL = '.url';
    export const SHORTCUT = 'Shortcut';
    export const BASE = 'osdrive';
    export const IMAGE_BASE_PATH = 'osdrive/Cheetah/System/Imageres/';
    export const ACCT_IMAGE_BASE_PATH = 'osdrive/Cheetah/System/Acct/';
    export const GIF_BASE_PATH = 'osdrive/Cheetah/System/Gifres/';
    export const AUDIO_BASE_PATH = 'osdrive/Cheetah/System/Media/';
    export const RECYCLE_BIN_PATH = '/Users/Desktop/Recycle Bin';
    export const DESKTOP_PATH = '/Users/Desktop';

    export const FILE_EXPLORER = 'fileexplorer';
    export const DESKTOP = 'desktop';
    export const FOLDER = 'folder';
    export const NEW_FOLDER = 'New Folder';
    export const CHEETAH = 'cheetah';
    export const WIN_EXPLR = 'win_explr_';

    export const DEFAULT_MENU_ORDER = 'DefaultMenuOrder';
    export const DEFAULT_FILE_MENU_ORDER = 'DefaultFileMenuOrder';
    export const DEFAULT_FOLDER_MENU_ORDER = 'DefaultFolderMenuOrder';
    export const FILE_EXPLORER_FILE_MENU_ORDER = 'FileExplorerFolderMenuOrder';
    export const FILE_EXPLORER_FOLDER_MENU_ORDER = 'FileExplorerfolderMenuOrder';
    export const FILE_EXPLORER_UNIQUE_MENU_ORDER = 'FileExploreruniqueMenuOrder';
    export const FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER = 'FileExplorerRecycleBinMenuOrder';
    export const RECYCLE_BIN_MENU_ORDER = 'RecycleBinMenuOrder';
    

    export const TASK_BAR_APP_ICON_MENU_OPTION =  'taskbar-app-icon-menu';
    export const TASK_BAR_CONTEXT_MENU_OPTION =  'taskbar-context-menu';
    export const NESTED_MENU_OPTION =  'nested-menu';
    export const FILE_EXPLORER_FILE_MANAGER_MENU_OPTION = 'file-explorer-file-manager-menu';
    export const POWER_MENU_OPTION = 'power-menu';

    export const RESERVED_ID_RUNNING_PROCESS_SERVICE = 4;
    
    export const SERVICES_STATE_RUNNING = 'Running';
    export const SERVICES_STATE_STOPPED = 'Stopped';

    export const SYSTEM_RESTART = 'Restart';
    export const SYSTEM_SHUT_DOWN = 'Shutdown';
    export const SYSTEM_ON = 'On';

    export const SIGNED_OUT = 'sOut';
    export const SIGNED_IN = 'sIn';

    export const CHEETAH_PWR_KEY = 'cheetahPwrKey';
    export const CHEETAH_LOGON_KEY = 'cheetahLogonKey';
    export const FILE_SVC_RESTORE_KEY = 'fileServiceRestoreKey';
    export const FILE_SVC_FILE_ITERATE_KEY = 'fileServiceFileIterateKey';

    export const USER_OPENED_APPS = 'usrOpenedApps'; 
    export const USER_OPENED_APPS_INSTANCE = 'usrOpenedAppsInstances';

    export const MERGED_TASKBAR_ENTRIES = 'Merged Entries Icon';
    export const DISTINCT_TASKBAR_ENTRIES = 'Distinct Entries Icon';

    export const CHEETAH_TASKBAR_ENTRY_OPTION_KEY = 'cheetahTskBarEntryOptKey';

    export const RSTRT_ORDER_LOCK_SCREEN = 0;
    export const RSTRT_ORDER_PWR_ON_OFF_SCREEN = 1;

    export const IMAGE_FILE_EXTENSIONS = [
        '.jpg',
        '.png',
        '.avif',
        '.bmp',
        '.ico',
        '.jpeg',
        '.tiff',
        '.tif',
        '.svg',
        '.webp',
        '.xlm'
    ]

    export const VIDEO_FILE_EXTENSIONS = [
        '.mp4',
        '.webm',
        '.ogg',
        '.mkv'
    ]

    export const AUDIO_FILE_EXTENSIONS = [
        '.mp3',
        '.flac',
        '.aac',
        '.dolby',
        '.mpeg',
        '.opus',
        '.m4a',
        '.ogg',
        '.oga',
        '.wav',
        '.caf',
        '.weba',
        '.webm'
    ]

    export const PROGRAMING_LANGUAGE_FILE_EXTENSIONS = [
        '.js',
        '.js.map',
        '.map',
        '.mjs',
        '.ts',
        '.cs',
        '.java',
        '.py',
        '.c',
        '.cpp',
        '.html'
    ]

    export const KNOWN_FILE_EXTENSIONS = [
        '.wasm',
        '.txt',
        '.properties',
        '.log',
        '.md',
        '.jsdos',
        '.swf',
        '.pdf',
        '.zip'
    ]

    export const FILE_EXTENSION_MAP = [
        ['.url','Shortcut File'],
        ['.txt','Text Document'],
        ['.log','Log File'],
        ['.wasm','WASM File'],
        ['.properties','Properties File '],
        ['.md','MarkDown File'],
        ['.swf','Small Web Format'],
        ['.jsdos','JSDos File'],
        ['.pdf','PDF File'],

        ['.jpg',  'JPEG File'],
        ['.png',  'PNG File'],
        ['.avif', 'AV1 Image File Format'],
        ['.bmp', 'Bitmap Image File'],
        ['.ico',  'Icon File'],
        ['.jpeg', 'JPEG File'],
        ['.tiff', 'Tagged Image File Format'],
        ['.tif', 'Tagged Image File Format'],
        ['.svg',  'SVG Files'],
        ['.webp', 'WebP Image File'],
        ['.xlm', 'Microsoft Excel Macro'],

        ['.mp3', 'MP3 Audio File'],
        ['.flac', 'FLAC File'],
        ['.aac', 'AAC File'],
        ['.dolby', 'Dolby Digital File'],
        ['.mpeg', 'MPEG Video File'],
        ['.opus', 'Opus Audio File'],
        ['.m4a', 'MPEG-4 Audio File'],
        ['.ogg', 'Ogg Vorbis File'],
        ['.oga', 'Ogg Vorbis Audio File'],
        ['.wav', 'WAV File'],
        ['.caf', 'CAF File'],
        ['.weba', 'WebM Audio File'],
        ['.webm', 'WebM Video File'],

        ['.mp4', 'MP4 Video File'],
        ['.webm', 'WebM Video File'],
        ['.mkv', 'Matroska Video File'],

        ['.js', 'JS File'],
        ['.js.map', 'JS Map File'],
        ['.map', ' Map'],
        ['.mjs', 'JS Module File'],
        ['.ts', 'TS File'],
        ['.cs', 'C# File'],
        ['.java', 'Java File'],
        ['.py', 'Python File'],
        ['.c', 'C File'],
        ['.cpp', 'C++ File'],
        ['.html', 'HTML File'],
        ['.zip', 'ZIP File']

    ]
}