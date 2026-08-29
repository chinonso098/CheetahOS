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
    export const UNDERSCORE = '_';
    export const HASH= '#';
    export const BACK_SLASH= '\\';
    export const DOUBLE_SLASH = '//';
    export const NEW_LINE = '\n';
    export const OSDISK = 'OSDisk (C:)';
    export const THISPC = 'This PC';
    export const QUICK_ACCESS = 'Quick access';
    export const RECYCLE_BIN = 'Recycle Bin';
    export const URL = '.url';
    export const SHORTCUT = 'Shortcut';
    export const BASE = 'osdrive';
    // Object URL prefix. The blob's origin mirrors the page origin, so it's
    // 'blob:http://...' on the local dev server but 'blob:https://...' on
    // gh-pages — checking the bare 'blob:' prefix covers both.
    export const BLOB_URI_PREFIX = 'blob:';

    /**
     * Sentinel written to a launch trigger's currentPath to mark a Settings launch
     * as a deep-link (e.g. the desktop "Personalize" context-menu entry) rather than
     * a normal launch. Kept distinct from any real OS path so it can never collide
     * with a file. The deep-link target is carried in the trigger's contentPath as
     * "<view>:<option>".
     */
    export const SETTINGS_DEEP_LINK = 'settings-deep-link';

    export const IMAGE_BASE_PATH = 'osdrive/Cheetah/System/Imageres/';
    export const LOCK_SCREEN_IMAGE_BASE_PATH = 'osdrive/Cheetah/Themes/LockScreen/';
    export const DESKTOP_IMAGE_BASE_PATH = 'osdrive/Cheetah/Themes/Desktop/';
    export const DYNAMIC_DESKTOP_BACKGROUND_PATH = "osdrive/Program-Files/Backgrounds/";
    export const ACCT_IMAGE_BASE_PATH = 'osdrive/Cheetah/System/Acct/';
    export const GIF_BASE_PATH = 'osdrive/Cheetah/System/Gifres/';
    export const AUDIO_BASE_PATH = 'osdrive/Cheetah/System/Media/';
    export const VIDEO_SCREEN_SAVER_BASE_PATH = 'osdrive/Cheetah/Themes/ScreenSavers/Videos/';
    export const WEBGL_SCREEN_SAVER_BASE_PATH = 'osdrive/Cheetah/Themes/ScreenSavers/WebGL/';
    export const RECYCLE_BIN_PATH = '/Users/Desktop/Recycle Bin';
    export const DESKTOP_PATH = '/Users/Desktop';
    export const DOCUMENTS_PATH = '/Users/Documents';
    export const DOWNLOADS_PATH = '/Users/Downloads';
    export const USER_BASE_PATH = '/Users';

    export const FILE_EXPLORER = 'fileexplorer';
    export const FILE_EXPLORER_NAME = 'File Explorer';
    export const DESKTOP = 'desktop';
    export const FOLDER = 'folder';
    export const NEW_FOLDER = 'New Folder';
    export const NEW_TEXT_FILE = 'New Text File.txt';
    export const CHEETAH = 'cheetah';
    export const CLIPBOARD = 'clipboard';
    export const WIN_EXPLR = 'win_explr_';
    export const FOLDER_OPTIONS_TITLE = 'Folder Options';
    export const NONE = 'None';

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
    export const CHECKABLE_MENU_OPTION = 'checkable-menu';

    export const RESERVED_ID_RUNNING_PROCESS_SERVICE = 4;
    export const OS_NAME = 'Cheetah OS';
    export const OS_VERSION = '5.8.28';
    export const OS_COPYRIGHT = '© 2026 Cheetah Software Inc. All rights reserved.';
    export const OS_BUILD = '260828' //date-based build number, in the format YYMMDD, used to track specific builds and updates of the OS.;
    export const OS_ARCHITECTURE = 'WEB-BASED';

    export const ON = 'On';
    export const OFF = 'Off'
    export const TRUE = 'true';
    export const FALSE = 'false';
    export const NEVER = 'Never';
    
    export const SERVICES_STATE_RUNNING = 'Running';
    export const SERVICES_STATE_STOPPED = 'Stopped';

    export const SYSTEM_RESTART = 'Restart';
    export const SYSTEM_SHUT_DOWN = 'Shut down';
    export const SYSTEM_ON = ON;

    export const SIGNED_OUT = 'sOut';
    export const SIGNED_IN = 'sIn';

    export const CHEETAH_PWR_KEY = 'cheetahPwrKey';
    export const CHEETAH_LOGON_KEY = 'cheetahLogonKey';
    export const CHEETAH_MOBILE_BANNER_KEY = 'cheetahMobileBannerKey';
    export const CHEETAH_DEFAULT_SETTINGS_KEY = 'cheetahDefaultSettingsKey';
    export const CHEETAH_DEFAULT_APP_OVERRIDE_KEY = 'cheetahDefaultAppOverrideKey';
    export const FILE_SVC_RESTORE_KEY = 'fileServiceRestoreKey';
    export const FILE_SVC_FILE_ITERATE_KEY = 'fileServiceFileIterateKey';



    /** Must match the maximizeRestoreAnimation duration (0.50s) in
    window.animations.ts.**/
    export const MAXIMIZE_RESTORE_ANIM_MS = 550;

    export const DEFAULT_LOCK_SCREEN_TIMEOUT = 'DEFAULT_LOCK_SCREEN_TIMEOUT';
    export const DEFAULT_LOCK_SCREEN_BACKGROUND = 'DEFAULT_LOCK_SCREEN_BACKGROUND';
    export const DEFAULT_DESKTOP_BACKGROUND = 'DEFAULT_DESKTOP_BACKGROUND';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_LOCK_SCREEN_TIMEOUT_VALUE = '1 Minute:60000';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_LOCK_SCREEN_BACKGROUND_VALUE = 'Mirror:Mirror';

    export const BACKGROUND_MIRROR = 'Mirror';
    export const BACKGROUND_DYNAMIC = 'Dynamic';
    export const BACKGROUND_PICTURE = 'Picture';
    export const BACKGROUND_SLIDE_SHOW = 'Slide show';
    export const BACKGROUND_SOLID_COLOR = 'Solid color';
    export const BACKGROUND_SLIDE_SHOW_PICTURE = BACKGROUND_PICTURE;
    export const BACKGROUND_SLIDE_SHOW_SOLID_COLOR = BACKGROUND_SOLID_COLOR;

    export const DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR = 'DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR';
    export const DEFAULT_PREVIOUS_DESKTOP_PICTURE = 'DEFAULT_PREVIOUS_DESKTOP_PICTURE';
    export const DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG = 'DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_DESKTOP_BACKGROUND_VALUE = 'Picture:osdrive/Cheetah/Themes/Desktop/crown_station.jpg';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_PREVIOUS_DESKTOP_SOLID_COLOR_VALUE = '#8f8cd6';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_PREVIOUS_DESKTOP_PICTURE_VALUE = 'osdrive/Cheetah/Themes/Desktop/crown_station.jpg';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_PREVIOUS_DESKTOP_DYNAMIC_IMG_VALUE = 'osdrive/Cheetah/Themes/Desktop/vanta_wave.jpg';
    
    export const COLOR_AND_PICTURE_SLIDE_DELAY = 28000; //28 secs

    export const DEFAULT_SCREEN_SAVER_STATE = 'DEFAULT_SCREEN_SAVER_STATE';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SCREEN_SAVER_STATE_VALUE = OFF;

    // The chosen screen saver, persisted as "Type:fileName" (e.g. "Dynamic:flowerbox.ssvr").
    export const DEFAULT_SCREEN_SAVER = 'DEFAULT_SCREEN_SAVER';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SCREEN_SAVER_VALUE = 'Dynamic:flowerbox.ssvr';

    export const SCREEN_SAVER_VIDEO = 'Video';
    export const SCREEN_SAVER_DYNAMIC = 'Dynamic';

    export const PRIMARY_SCREEN_SAVER_DELAY = 30000; //30 secs
    export const SECONDARY_SCREEN_SAVER_DELAY = 5000; //5 secs

    export const DEFAULT_AUTO_HIDE_TASKBAR = 'DEFAULT_AUTO_HIDE_TASKBAR';
    export const DEFAULT_TASKBAR_COMBINATION = 'DEFAULT_TASKBAR_COMBINATION';
    export const TASKBAR_COMBINATION_NEVER = NEVER;
    export const TASKBAR_COMBINATION_ALWAYS_HIDE_LABELS = 'Always Hide Labels';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_TASKBAR_COMBINATION_VALUE = NEVER;
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_AUTO_HIDE_TASKBAR_VALUE = FALSE;
  

    export const DEFAULT_CLIP_BOARD_STATE = 'DEFAULT_CLIP_BOARD_STATE';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_CLIP_BOARD_STATE_VALUE = TRUE;

    export const USER_OPENED_APPS = 'usrOpenedApps'; 
    export const USER_OPENED_APPS_INSTANCE = 'usrOpenedAppsInstances';

    export const CLIPBOARD_DATA = 'clipBoardData';

    export const MERGED_TASKBAR_ENTRIES = 'Merged Entries Icon';
    export const DISTINCT_TASKBAR_ENTRIES = 'Distinct Entries Icon';

    export const CHEETAH_TASKBAR_ENTRY_OPTION_KEY = 'cheetahTskBarEntryOptKey';

    export let D = 0;
    export const RSTRT_ORDER_LOCK_SCREEN = 0;
    export const RSTRT_ORDER_PWR_ON_OFF_SCREEN = 1;
    export const STORAGE_CAPACITY = 1024_100_500;

    export const DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG = 'DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_DISPLAY_DELETE_CONFIRMATION_DIALOG_VALUE = TRUE;

    export const DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE = 'DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_MOVE_TO_RECYCLE_BIN_ON_DELETE_VALUE = TRUE;

    export const DEFAULT_RESTORE_USER_OPENED_APPS = 'DEFAULT_RESTORE_USER_OPENED_APPS';
    
    export const DEFAULT_IS_USER_OPENED_APPS_RESTORED = 'DEFAULT_IS_USER_OPENED_APPS_RESTORED';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_RESTORE_USER_OPENED_APPS_VALUE = TRUE;

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_IS_USER_OPENED_APPS_RESTORED_VALUE = FALSE;

    export const DEFAULT_ENFORCE_VIEWPORT_BOUNDS = 'DEFAULT_ENFORCE_VIEWPORT_BOUNDS';
    
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_ENFORCE_VIEWPORT_BOUNDS_VALUE = TRUE;

    export const DEFAULT_SYSTEM_COLOR = '#000000';
    export const DEFAULT_SYSTEM_COLOR_2 = '#ffffff';
    

    // System-wide light/dark theme. Persisted as one of THEME_DARK / THEME_LIGHT.
    export const THEME_DARK = 'dark';
    export const THEME_LIGHT = 'light';
    export const DEFAULT_THEME = 'DEFAULT_THEME';

    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_THEME_VALUE = THEME_DARK;

    export const RECENT_CHEETAH_COLORS = 'RECENT_CHEETAH_COLORS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const RECENT_CHEETAH_COLORS_VALUE = EMPTY_STRING;

    export const DEFAULT_ACCENT_COLOR = 'DEFAULT_ACCENT_COLOR';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_ACCENT_COLOR_VALUE = '#0078d7';

    export const DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR = 'DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_ACCENT_COLOR_START_MENU_AND_TASKBAR_VALUE = FALSE;
    
    export const DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS = 'DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_ACCENT_COLOR_TITLE_BARS_AND_WINDOW_BORDERS_VALUE = FALSE;

    export const DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER = 'DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_TRANSPARENCY_EFFECT_ON_TITLE_BAR_AND_WINDOW_BORDER_VALUE = FALSE;

    export const DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU = 'DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_APPLY_TRANSPARENCY_EFFECT_TO_CONTEXT_MENU_VALUE = FALSE;

    export const DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU = 'DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_APPLY_ACCENT_COLOR_TO_TRANSPARENT_MENU_VALUE = FALSE;

    export const DEFAULT_SHOW_TRANSPARENCY_EFFECT = 'DEFAULT_SHOW_TRANSPARENCY_EFFECT';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_TRANSPARENCY_EFFECT_VALUE = FALSE;

    export const DEFAULT_WHO_IS_THIS = 'DEFAULT_WHO_IS_THIS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const UNKNOWN = "Unknown";
    export const DEFAULT_WHO_IS_THIS_VALUE = UNKNOWN;

    export const PROD_END_POINT = 'https://chinonso098.github.io/cheetahos.github.io/';
    export const ENVIRONMENT = 'ENVIRONMENT';
    export const PROD = 'PROD';
    export const NON_PROD = 'NON-PROD';

    /**⚠️ WARNING: Do not reference directly.*/
    export const ENVIRONMENT_VALUE = NON_PROD;

    export const DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS = 'DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_HIDDEN_FILES_AND_FOLDERS_VALUE = FALSE;

    export const DEFAULT_SHOW_FILE_EXTENSIONS = 'DEFAULT_SHOW_FILE_EXTENSIONS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_FILE_EXTENSIONS_VALUE = FALSE;

    export const DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR = 'DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR';    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_DISPLAY_FULL_PATH_IN_TITLE_BAR_VALUE = FALSE;

    export const DEFAULT_OPEN_FILE_EXPLORER_TO = 'DEFAULT_OPEN_FILE_EXPLORER_TO';
    export const OPEN_FILE_EXPLORER_TO_QUICK_ACCESS = 'Quick access';
    export const OPEN_FILE_EXPLORER_TO_THIS_PC = 'This PC';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_OPEN_FILE_EXPLORER_TO_VALUE = OPEN_FILE_EXPLORER_TO_QUICK_ACCESS;

    export const DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW = 'DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_OPEN_FOLDER_IN_SAME_WINDOW_VALUE = TRUE;

    export const DEFAULT_SHOW_RECENTLY_USED_FILES = 'DEFAULT_SHOW_RECENTLY_USED_FILES';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_RECENTLY_USED_FILES_VALUE = TRUE;

    export const DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS = 'DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_FREQUENTLY_USED_FOLDERS_VALUE = TRUE;

    export const DEFAULT_SHOW_KNOWN_FILE_TYPES = 'DEFAULT_SHOW_KNOWN_FILE_TYPES';
    /**⚠️ WARNING: Do not reference directly.*/
    export const DEFAULT_SHOW_KNOWN_FILE_TYPES_VALUE = TRUE;


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
        '.xlm',
        '.gif'
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
        '.zip',
        '.ssvr'
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
        ['.ssvr','Screen Saver File'],
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
        ['.zip', 'Compressed (zipped) Folder'],
        ['.cab', 'CAB File']

    ]

    export const LOCKSCREEN_DESKTOP_COLORS =[
        '#fe8d00', '#e91022', '#d13337', '#c30052', '#bf0077', '#9a0088', '#871499', '#754caa',
        '#0f893e', '#0c7d10', '#008473', '#2b7d9a', '#0063b1', '#6a68d6', '#8f8cd6', '#8664ba',
        '#008386', '#45695f', '#525f54', '#7e7360', '#4c4a48', '#4f5d6b', '#4a545a', '#000203'
    ]

    export const CHEETAH_COLORS =[
        '#ffb900', '#ff8c00', '#f7630c', '#ca5010', '#da3b01', '#ef6950', '#871499', '#d13438',
        '#e74856', '#e81123', '#ea005e', '#c30052', '#e3008c', '#bf0077', '#c239b3', '#9a0089',
        '#0078d7', '#0063b1', '#8e8cd8', '#6b69d6', '#8764b8', '#744da9', '#b146c2', '#881798',
        '#0099bc', '#2d7d9a', '#00b7c3', '#038387', '#00b294', '#018574', '#00cc6a', '#10893e',
        '#7a7574', '#5d5a58', '#68768a', '#515c6b', '#567c73', '#486860', '#498205', '#107c10'
    ]

    export const LOCKSCREEN_PICTURE_SET = [
        'bamboo_moon.jpg', 'duck_lake.jpeg', 'forza_5.jpeg', 'highland_view.jpg',
        'leaf_colors.jpg', 'lofi_coffee.jpeg', 'mountain_babel.jpg', 'mystic_isle.jpg', 
        'over_the_ocean.jpg', 'paradise_island.jpg', 'purple_reign.jpg', 'win_xp_bliss.jpeg'
    ]

    export const DESKTOP_DYNAMIC_PICTURE_SET = ['vanta_wave.jpg', 'vanta_halo.jpg', 'vanta_ring.jpg', 'vanta_globe.jpg', 'vanta_bird.jpg']
    
    export const DESKTOP_PICTURE_SET = ['crown_station.jpg', 'cyber_city.jpg', 'fractal_design.jpeg', 'landscape.jpg',
        'mineral_heart.jpg', 'summer_vibe.jpg', 'sun_set.jpg', 'win_seven.jpg']


    //Other Z-Indexes
    export const Z_INDEX_TASKBAR_ELEMENTS = 5;
    //export const Z_INDEX_LOGIN_MENU = 6;
    export const Z_INDEX_DESKTOP_ICON_CONTEXT_MENU = 4;   
    export const Z_INDEX_DESKTOP_CONTEXT_MENU = 4;
    export const Z_INDEX_FILE_EXPLORER_CONTEXT_MENU = 20;


    export const USER_DEV = 'dev_dev';
    export const USER_GUEST = 'guest';  
    export const USER_GUEST_PASSWORD = '1234';
    
}