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
    export const HASH= '#';
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
    export const LOCK_SCREEN_IMAGE_BASE_PATH = 'osdrive/Cheetah/Themes/LockScreen/';
    export const DESKTOP_IMAGE_BASE_PATH = 'osdrive/Cheetah/Themes/Desktop/';
    export const DYNAMIC_DESKTOP_BACKGROUND_PATH = "osdrive/Program-Files/Backgrounds/";
    export const ACCT_IMAGE_BASE_PATH = 'osdrive/Cheetah/System/Acct/';
    export const GIF_BASE_PATH = 'osdrive/Cheetah/System/Gifres/';
    export const AUDIO_BASE_PATH = 'osdrive/Cheetah/System/Media/';
    export const SCREEN_SAVER_BASE_PATH = 'osdrive/Cheetah/Themes/ScreenSavers/';
    export const RECYCLE_BIN_PATH = '/Users/Desktop/Recycle Bin';
    export const DESKTOP_PATH = '/Users/Desktop';
    export const USER_BASE_PATH = '/Users';

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

    export const ON = 'On';
    export const OFF = 'Off'
    export const TRUE = 'true';
    export const FALSE = 'false';
    export const NEVER = 'Never';
    
    export const SERVICES_STATE_RUNNING = 'Running';
    export const SERVICES_STATE_STOPPED = 'Stopped';

    export const SYSTEM_RESTART = 'Restart';
    export const SYSTEM_SHUT_DOWN = 'Shutdown';
    export const SYSTEM_ON = ON;

    export const SIGNED_OUT = 'sOut';
    export const SIGNED_IN = 'sIn';

    export const CHEETAH_PWR_KEY = 'cheetahPwrKey';
    export const CHEETAH_LOGON_KEY = 'cheetahLogonKey';
    export const CHEETAH_DEFAULT_SETTINGS_KEY = 'cheetahDefaultSettingsKey';
    export const FILE_SVC_RESTORE_KEY = 'fileServiceRestoreKey';
    export const FILE_SVC_FILE_ITERATE_KEY = 'fileServiceFileIterateKey';

    export const DEFAULT_LOCK_SCREEN_TIMEOUT = 'LOCK_SCREEN_TIMEOUT';
    export const DEFAULT_LOCK_SCREEN_BACKGROUND = 'LOCK_SCREEN_BACKGROUND';
    export const DEFAULT_DESKTOP_BACKGROUND = 'DESKTOP_BACKGROUND';

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
    export const SCREEN_SAVER_DELAY = 15000; //15 secs

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

    export const MERGED_TASKBAR_ENTRIES = 'Merged Entries Icon';
    export const DISTINCT_TASKBAR_ENTRIES = 'Distinct Entries Icon';

    export const CHEETAH_TASKBAR_ENTRY_OPTION_KEY = 'cheetahTskBarEntryOptKey';

    export const RSTRT_ORDER_LOCK_SCREEN = 0;
    export const RSTRT_ORDER_PWR_ON_OFF_SCREEN = 1;
    export const STORAGE_CAPACITY = 512_050_500;

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

    export const LOCKSCREEN_DESKTOP_COLORS =[
        '#fe8d00', '#e91022', '#d13337', '#c30052', '#bf0077', '#9a0088', '#871499', '#754caa',
        '#0f893e', '#0c7d10', '#008473', '#2b7d9a', '#0063b1', '#6a68d6', '#8f8cd6', '#8664ba',
        '#008386', '#45695f', '#525f54', '#7e7360', '#4c4a48', '#4f5d6b', '#4a545a', '#000203'
    ]

    export const LOCKSCREEN_PICTURE_SET = [
        'bamboo_moon.jpg', 'duck_lake.jpeg', 'forza_5.jpeg', 'highland_view.jpg',
        'leaf_colors.jpg', 'lofi_coffee.jpeg', 'mountain_babel.jpg', 'mystic_isle.jpg', 
        'over_the_ocean.jpg', 'paradise_island.jpg', 'purple_reign.jpg', 'win_xp_bliss.jpeg'
    ]

    export const DESKTOP_DYNAMIC_PICTURE_SET = ['vanta_wave.jpg', 'vanta_halo.jpg', 'vanta_ring.jpg', 'vanta_globe.jpg', 'vanta_bird.jpg']
    
    export const DESKTOP_PICTURE_SET = ['crown_station.jpg', 'cyber_city.jpg', 'fractal_design.jpeg', 'landscape.jpg',
        'mineral_heart.jpg', 'summer_vibe.jpg', 'sun_set.jpg', 'win_seven.jpg']
        
}