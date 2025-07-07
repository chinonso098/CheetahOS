import { Constants } from "./constants";

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

}
