/**
 * Pure keyboard-navigation index math for the File Explorer list.
 *
 * Given a key and the current grid shape, computes the next selection index.
 * Action keys (Enter / F2 / Escape) have side effects and stay in the
 * component; only the grid-movement arithmetic lives here.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerKeyboardHelper {

    /**
     * Return the next selection index for a grid-navigation key, or `null`
     * when `key` is not a navigation key (caller handles Enter/F2/Escape/etc).
     *
     * @param key      KeyboardEvent.key value.
     * @param current  Currently selected index (-1 when nothing is selected).
     * @param total    Number of items in the list.
     * @param columns  Items per row (1 in details view).
     */
    export const computeNextIndex = (key:string, current:number, total:number, columns:number):number | null => {
        if(total === 0) return null;

        switch(key){
            case 'ArrowRight': return current < 0 ? 0 : Math.min(current + 1, total - 1);
            case 'ArrowLeft':  return current < 0 ? 0 : Math.max(current - 1, 0);
            case 'ArrowDown':  return current < 0 ? 0 : Math.min(current + columns, total - 1);
            case 'ArrowUp':    return current < 0 ? 0 : Math.max(current - columns, 0);
            case 'Home':       return 0;
            case 'End':        return total - 1;
            default:           return null;
        }
    }
}
