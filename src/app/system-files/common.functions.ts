import { SortBys } from "./common.enums";
import { Constants } from "./constants";
import { FileInfo } from "./file.info";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CommonFunctions {

    export const getReadableFileSizeValue = (size: number): number => {
        let tmpSize = Constants.NUM_ZERO;

        if (size >= Constants.NUM_ZERO && size <= 999) {
            tmpSize = size;
        } else if (size >= 1_000 && size <= 999_999) {
            tmpSize = Math.round((size / 1_000) * 100) / 100;
        } else if (size >= 1_000_000 && size <= 999_999_999) {
            tmpSize = Math.round((size / 1_000_000) * 100) / 100;
        } else if (size >= 1_000_000_000 && size <= 999_999_999_999) {
            tmpSize = Math.round((size / 1_000_000_000) * 100) / 100;
        }

        return tmpSize;
    };

    export const getFileSizeUnit = (size: number): string => {
        if (size >= Constants.NUM_ZERO && size <= 999) {
            return 'B';
        } else if (size >= 1_000 && size <= 999_999) {
            return 'KB';
        } else if (size >= 1_000_000 && size <= 999_999_999) {
            return 'MB';
        } else if (size >= 1_000_000_000 && size <= 999_999_999_999) {
            return 'GB';
        } else {
            return 'TB'; // Optional fallback
        }
    };

    export const sortIconsBy = (files:FileInfo[], sortBy:string):FileInfo[] =>{
        let sortedFiles:FileInfo[] = [];
        if(sortBy === SortBys.SIZE){
          sortedFiles = files.sort((objA, objB) => objB.getSizeInBytes - objA.getSizeInBytes);
        }else if(sortBy ===SortBys.DATE_MODIFIED){
          sortedFiles = files.sort((objA, objB) => objB.getDateModified.getTime() - objA.getDateModified.getTime());
        }else if(sortBy === SortBys.NAME){
          sortedFiles = files.sort((objA, objB) => {
            return objA.getFileName < objB.getFileName ? Constants.MINUS_ONE : Constants.NUM_ONE;
          });
        }else if(sortBy === SortBys.ITEM_TYPE){
          sortedFiles = files.sort((objA, objB) => {
            return objA.getFileType < objB.getFileType ? Constants.MINUS_ONE : Constants.NUM_ONE;
          });
        }

        return sortedFiles;
      }

}
