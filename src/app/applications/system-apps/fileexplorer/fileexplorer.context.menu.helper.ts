 
import { MenuAction } from "src/app/shared/system-ui-components/menu/menu.enums";
import { MenuPosition, GeneralMenu } from "src/app/shared/system-ui-components/menu/menu.types";
import { Constants } from "src/app/system-files/constants";
import { FileInfo } from "src/app/system-files/fs/file.info";

/**
 * Pure context-menu logic for the File Explorer.
 *
 * Mirrors the desktop's `DesktopContextMenuHelper` pattern: stateless functions
 * that receive everything they need as parameters (the content-area
 * `DOMRect`, the click event, the source menu rows, pre-computed flags) and
 * return plain results. They never touch component state or Angular DI — the
 * caller applies the returned values to `this.*`.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerContextMenuHelper {

    // Files whose backing .url shortcut is a protected user folder and so may
    // not be cut / deleted / renamed / extracted.
    const EDIT_NOT_ALLOWED:string[] = ['3d-objects.url', 'desktop.url', 'documents.url', 'downloads.url', 'games.url', 'music.url', 'pictures.url', 'videos.url'];

    /**
     * Compute where the context menu should be placed so it stays inside the
     * File Explorer content area, plus whether nested sub-menus must flip to
     * the left (returned as the second tuple element since the caller stores it
     * on `this.isShiftSubMenuLeft`).
     *
     * `rect` is the content container's bounding rect, supplied by the caller
     * via its `@ViewChild` ElementRef — keeps this helper free of DOM lookups.
     */
    export const checkAndHandleMenuBounds = (rect:DOMRect, evt:MouseEvent, menuHeight:number):[MenuPosition, boolean] => {
        const menuWidth = 210;
        const subMenuWidth = 205;

        // Cursor position relative to the content container. That container is
        // `position: relative` (anchor for the lasso + search overlay), so it is
        // also the offsetParent of the absolutely-positioned context menu — which
        // means these container-relative coordinates ARE the menu's left/top.
        // (Previously a +180/+65 offset was added here to compensate for the nav
        // pane width + header height; that was only correct when the menu's
        // offsetParent was the full file-explorer container, and it pushed the
        // menu 180px right / 65px down once the content container became the
        // offsetParent. Removed so the menu opens at the cursor, like the desktop.)
        const mousePositionX = evt.clientX - rect.left;
        const mousePositionY = evt.clientY - rect.top;

        // Space remaining to the right / bottom edges of the content area.
        const distanceToRightBoundary = rect.right - evt.clientX;
        const distanceToBottomBoundary = rect.bottom - evt.clientY;

        let xAxis = mousePositionX;
        let yAxis = mousePositionY;

        // Flip the menu left when it would overflow the right edge.
        if(distanceToRightBoundary < menuWidth){
            xAxis = mousePositionX - (menuWidth - distanceToRightBoundary);
        }

        // Shift the menu up when it would overflow the bottom edge. `rect.bottom`
        // is the content container's bottom, which already sits above the footer,
        // so no extra footer subtraction is needed.
        if(distanceToBottomBoundary < menuHeight){
            yAxis = mousePositionY - (menuHeight - distanceToBottomBoundary);
        }

        // Nested sub-menus flip left when there isn't room for menu + sub-menu.
        const isShiftSubMenuLeft = distanceToRightBoundary <= (menuWidth + subMenuWidth);

        // Keep values non-negative without changing normal placement behavior.
        xAxis = Math.max(0, xAxis);
        yAxis = Math.max(0, yAxis);

        return [{xAxis, yAxis}, isShiftSubMenuLeft];
    }

    /**
     * Filter / re-order the icon context-menu rows based on whether the icon
     * points at a file, the recycle-bin folder, or a regular folder.
     *
     * Returns `[menuData, menuOrder]`; the recycle-bin flag is supplied
     * pre-computed by the caller so this helper stays pure.
     */
    export const adjustIconContextMenuData = (file:FileInfo, sourceData:GeneralMenu[], isRecycleBinFolder:boolean):[GeneralMenu[], string] => {
        const isZipFile = file.getFileExtension === '.zip';
        const isUrl = file.getFileExtension === Constants.URL || file.getFileType === Constants.URL;
        // Allow-list of rows kept for anything shown inside the Recycle Bin (file or folder).
        const recycleBinAllowed = new Set<string>([MenuAction.RESTORE, MenuAction.CUT, MenuAction.DELETE, MenuAction.PROPERTIES]);

        // --- File ---
        if(file.getIsFile){
            // Protected user-folder shortcut: can't be cut / deleted / renamed / extracted / re-targeted.
            const relativePath = file.getCurrentPath.replace(Constants.ROOT, Constants.EMPTY_STRING);
            if(EDIT_NOT_ALLOWED.includes(relativePath)){
                const excluded = new Set<string>([MenuAction.CUT, MenuAction.DELETE, MenuAction.RENAME, MenuAction.EXTRACT_ALL, MenuAction.OPEN_WITH]);
                return [sourceData.filter(x => !excluded.has(x.label)), Constants.FILE_EXPLORER_UNIQUE_MENU_ORDER];
            }

            if(isRecycleBinFolder){
                return [sourceData.filter(x => recycleBinAllowed.has(x.label)), Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER];
            }

            // Regular file: drop rows that don't apply to files, plus zip-/URL-specific rows.
            const excluded = new Set<string>([MenuAction.OPEN_IN_TERMINAL, MenuAction.PIN_TO_QUICK_ACCESS, MenuAction.OPEN_IN_NEW_WINDOW, MenuAction.PIN_TO_START, MenuAction.RESTORE]);
            const menuData = sourceData.filter(x =>
                !excluded.has(x.label)
                && !(x.label === MenuAction.EXTRACT_ALL && !isZipFile)   // "Extract All..." only for .zip files
                && !(x.label === MenuAction.OPEN_WITH && isUrl));        // "Open with..." hidden for URL shortcuts

            return [menuData, Constants.FILE_EXPLORER_FILE_MENU_ORDER];
        }

        // --- Folder ---
        if(isRecycleBinFolder){
            return [sourceData.filter(x => recycleBinAllowed.has(x.label)), Constants.FILE_EXPLORER_RECYCLE_BIN_MENU_ORDER];
        }

        // Regular folder: drop file-only rows.
        const excluded = new Set<string>([MenuAction.RESTORE, MenuAction.EXTRACT_ALL, MenuAction.OPEN_WITH]);
        return [sourceData.filter(x => !excluded.has(x.label)), Constants.FILE_EXPLORER_FOLDER_MENU_ORDER];
    }
}
