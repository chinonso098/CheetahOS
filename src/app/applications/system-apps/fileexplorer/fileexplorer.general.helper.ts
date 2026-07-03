import { NestedMenuItem } from "src/app/shared/system-ui-components/menu/menu.types"
import { Constants } from "src/app/system-files/constants"
import { FileInfo } from "src/app/system-files/fs/file.info"

/**
 * General-purpose, stateless builders for the File Explorer.
 *
 * Mirrors the desktop's `DesktopGeneralHelper`: the nested context-menu rows
 * are assembled here from action callbacks + check-state flags passed in by the
 * component, so this module never touches component state or Angular DI.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerGeneralHelper {

    /** Build the "View" sub-menu (icon-size choices). */
    export const handleBuildViewByMenu = (
        extraLargeIconAction:(event:MouseEvent) => void, isExtraLargeIcon:boolean,
        largeIconAction:(event:MouseEvent) => void, isLargeIcon:boolean,
        mediumIconAction:(event:MouseEvent) => void, isMediumIcon:boolean,
        smallIconAction:(event:MouseEvent) => void, isSmallIcon:boolean,
        detailsIconAction:(event:MouseEvent) => void, isDetailsIcon:boolean):NestedMenuItem[] => {

        const extraLargeIcon:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Extra Large icons', action: extraLargeIconAction,
            variables:isExtraLargeIcon, emptyline:false, styleOption:'A' }

        const largeIcon:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Large icons', action: largeIconAction,
            variables:isLargeIcon, emptyline:false, styleOption:'A' }

        const mediumIcon:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Medium icons', action: mediumIconAction,
            variables:isMediumIcon, emptyline:false, styleOption:'A' }

        const smallIcon:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Small icons', action: smallIconAction,
            variables:isSmallIcon, emptyline:false, styleOption:'A' }

        const detailsIcon:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Details icons', action: detailsIconAction,
            variables:isDetailsIcon, emptyline:false, styleOption:'A' }

        return [extraLargeIcon, largeIcon, mediumIcon, smallIcon, detailsIcon];
    }

    /** Build the "Sort by" sub-menu. */
    export const handleBuildSortByMenu = (
        sortByNameAction:(event:MouseEvent) => void, isSortByName:boolean,
        sortBySizeAction:(event:MouseEvent) => void, isSortBySize:boolean,
        sortByItemTypeAction:(event:MouseEvent) => void, isSortByItemType:boolean,
        sortByDateModifiedAction:(event:MouseEvent) => void, isSortByDateModified:boolean):NestedMenuItem[] => {

        const sortByName:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Name', action: sortByNameAction, variables:isSortByName,
            emptyline:false, styleOption:'A' }

        const sortBySize:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Size', action: sortBySizeAction, variables:isSortBySize,
            emptyline:false, styleOption:'A' }

        const sortByItemType:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Item type', action: sortByItemTypeAction, variables:isSortByItemType,
            emptyline:false, styleOption:'A' }

        const sortByDateModified:NestedMenuItem={ icon:Constants.EMPTY_STRING, label:'Date modified', action: sortByDateModifiedAction, variables:isSortByDateModified,
            emptyline:false, styleOption:'A' }

        return [sortByName, sortBySize, sortByItemType, sortByDateModified];
    }

    /** Build the "New" sub-menu (Folder / Text File). No component state. */
    export const handleBuildNewMenu = (
        createFolderAction:() => void,
        createTextFileAction:() => void):NestedMenuItem[] => {
        const newFolder:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}empty_folder.png`, label:'Folder', action:createFolderAction, variables:true,
            emptyline:false, styleOption:'C' }

        const textFile:NestedMenuItem={ icon:`${Constants.IMAGE_BASE_PATH}text_file.png`, label:'Text File', action:createTextFileAction, variables:true,
            emptyline:false, styleOption:'C' }

        return [newFolder, textFile];
    }

    /**
     * Summarize a directory's contents into two comma-separated preview
     * strings `[filesList, foldersList]`, each capped at `maxItems` names.
     * Used by the folder information tip.
     */
    export const summarizeDirectoryContents = (directoryFiles:FileInfo[], maxItems = 10):[string, string] => {
        const files:string[] = [];
        const folders:string[] = [];

        for(const file of directoryFiles){
            if(file.getIsFile){
                if(files.length < maxItems) files.push(file.getFileName);
            }else{
                if(folders.length < maxItems) folders.push(file.getFileName);
            }

            if(files.length >= maxItems && folders.length >= maxItems) break;
        }

        const filesList = (files.length > 0) ? files.join(', ') : Constants.EMPTY_STRING;
        const foldersList = (folders.length > 0) ? folders.join(', ') : Constants.EMPTY_STRING;

        return [filesList, foldersList];
    }
}
