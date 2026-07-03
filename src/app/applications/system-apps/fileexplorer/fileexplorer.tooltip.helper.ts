import { dirname } from "path";
import { Constants } from "src/app/system-files/constants";
import { FileToolTip } from "./fileexplorer.types";
import { CommonFunctions } from "src/app/system-files/commons/common.functions";
import { FileInfo } from "src/app/system-files/fs/file.info";

/**
 * Builds the rich "information tip" rows shown when hovering a file/folder.
 *
 * All I/O (folder size, recycle-bin origin, child listing) is injected via
 * {@link InfoTipDeps}, so this module stays free of Angular DI and component
 * state. It returns a fresh `FileToolTip[]` for the caller to assign.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerTooltipHelper {

    export interface InfoTipDeps {
        getFolderSizeAsync:(path:string) => Promise<number>;
        getFolderOrigin:(path:string) => string;
        getFilesAndFolders:(path:string) => Promise<string[]>;
        loadImageContent:(path:string) => Promise<FileInfo>;
        isRecycleBinFolder:boolean;
    }

    export const buildInformationTip = async (file:FileInfo, deps:InfoTipDeps):Promise<FileToolTip[]> => {
        const infoTipFields = ['Author:', 'Item type:', 'Date created:', 'Date modified:', 'Dimensions:', 'General', 'Size:', 'Type:', 'Original location:', 'Files:', 'Folders:'];
        const specialFolders:Record<string, string> = {
            'Music': 'Contains music and other audio files',
            'Videos': 'Contains movies and other video files',
            'Pictures': 'Contains digital photos, images and graphic files'
        };
        const standardFolders = ['3D-Objects', 'Documents', 'Downloads', 'Desktop', 'Games'];

        const fileType = file.getFileType;
        const fileDateModified = file.getDateModifiedUS;
        const fileSize = `${String(file.getSize)}  ${file.getFileSizeUnit}`;
        const fileName = file.getFileName;
        const isFile = file.getIsFile;
        const currentPath = dirname(file.getCurrentPath);
        const isRoot = currentPath === Constants.ROOT;

        let isFolder = fileType === Constants.FOLDER;

        const infoTipData:FileToolTip[] = [];

        // Special Cases: normally IsFile & IsFolder can't both be true, except for
        // a few .url entries (fileexplorer.url, music.url, ...). Prefer "file".
        if(isFile && isFolder){ isFolder = false; }

        if(Constants.IMAGE_FILE_EXTENSIONS.includes(file.getFileType)){
            // due to lazy loading, the file's content isn't loaded yet; ask the
            // caller to explicitly load the image content so we can read its dimensions.
            const imageFile = await deps.loadImageContent(file.getCurrentPath);

            await new Promise<void>((resolve) => {
                const img = new Image();
                img.src = imageFile.getContentPath;
                img.onload = () => {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    const imgDimensions = `${width} x ${height}`;

                    infoTipData.push({
                        label: infoTipFields[1],
                        data: `${imageFile.getFileType.replace(Constants.DOT, Constants.EMPTY_STRING).toLocaleUpperCase()} File`
                    });

                    infoTipData.push({ label: infoTipFields[4], data: imgDimensions });
                    infoTipData.push({ label: infoTipFields[6], data: fileSize });

                    resolve();
                };
                img.onerror = (err) => {
                    console.error("Failed to load image", err);
                    resolve(); // Still resolve to prevent blocking
                };
            });
        }else if(isFile && !isFolder){
            const fileTypeName = (fileType !== Constants.FOLDER) ? CommonFunctions.getFileTypeName(fileType) : CommonFunctions.getFileTypeName(Constants.URL);
            infoTipData.push({ label: infoTipFields[7], data: fileTypeName });
            infoTipData.push({ label: infoTipFields[3], data: fileDateModified });
            infoTipData.push({ label: infoTipFields[6], data: fileSize });
        }
        else if(isFolder){
            if(isRoot && (standardFolders.includes(fileName))){
                infoTipData.push({ label: infoTipFields[2], data: fileDateModified });
            }else if((isRoot && specialFolders[fileName])){
                infoTipData.push({ label: Constants.EMPTY_STRING, data: specialFolders[fileName] });
            }else{
                infoTipData.push({ label: infoTipFields[2], data: fileDateModified });

                const folderSizeInBytes = await deps.getFolderSizeAsync(file.getCurrentPath);
                const folderSize = CommonFunctions.getReadableFileSizeValue(folderSizeInBytes);
                const folderUnit = CommonFunctions.getFileSizeUnit(folderSizeInBytes);

                const sizeLabelExists = infoTipData.some(x => x.label === infoTipFields[6]);
                if(!sizeLabelExists){
                    infoTipData.push({ label: infoTipFields[6], data: `${String(folderSize)} ${folderUnit}` });
                }

                if(deps.isRecycleBinFolder){
                    const originalLocation = deps.getFolderOrigin(file.getCurrentPath);
                    infoTipData.push({ label: infoTipFields[8], data: originalLocation });
                }

                const filesAndFolders = await deps.getFilesAndFolders(file.getCurrentPath);
                if(filesAndFolders[0] !== Constants.EMPTY_STRING)
                    infoTipData.push({ label: infoTipFields[9], data: filesAndFolders[0] });

                if(filesAndFolders[1] !== Constants.EMPTY_STRING)
                    infoTipData.push({ label: infoTipFields[10], data: filesAndFolders[1] });
            }
        }

        return infoTipData;
    }
}
