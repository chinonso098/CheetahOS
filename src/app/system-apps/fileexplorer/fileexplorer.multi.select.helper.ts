/**
 * Pure lasso-selection geometry for the File Explorer.
 *
 * Coordinate math only — no DOM traversal, no component state. The component
 * still owns the icon {@link QueryList} walk and the highlighted-id Set; it
 * just asks this module to compute the lasso rectangle, the selection bounds,
 * and to run the per-icon hit test.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace FileExplorerMultiSelectHelper {

    /** A pointer position. `MouseEvent` satisfies this structurally. */
    export interface Point {
        clientX:number;
        clientY:number;
    }

    /** Lasso rectangle in container-local (top-left relative) pixels. */
    export interface LassoRect {
        left:number;
        top:number;
        width:number;
        height:number;
    }

    /** Selection rectangle in viewport (page) coordinates for hit testing. */
    export interface SelectionBounds {
        left:number;
        top:number;
        right:number;
        bottom:number;
    }

    /**
     * Compute the lasso rectangle (relative to the container) from the drag's
     * start and current pointer positions. Handles dragging in any direction
     * via Math.min / Math.abs.
     */
    export const computeLassoRect = (rect:DOMRect, start:Point, current:Point):LassoRect => {
        const startingXPoint = start.clientX - rect.left;
        const startingYPoint = start.clientY - rect.top;

        const currentXPoint = current.clientX - rect.left;
        const currentYPoint = current.clientY - rect.top;

        return {
            left:   Math.min(startingXPoint, currentXPoint),
            top:    Math.min(startingYPoint, currentYPoint),
            width:  Math.abs(startingXPoint - currentXPoint),
            height: Math.abs(startingYPoint - currentYPoint),
        };
    }

    /**
     * Convert a container-local lasso rectangle into absolute viewport bounds
     * so it can be compared against `getBoundingClientRect()` icon rects.
     */
    export const computeSelectionBounds = (initX:number, initY:number, width:number, height:number, rect:DOMRect):SelectionBounds => {
        return {
            left:   initX + rect.left,
            top:    initY + rect.top,
            right:  initX + rect.left + width,
            bottom: initY + rect.top + height,
        };
    }

    /** Axis-aligned intersection test between an icon rect and the selection. */
    export const intersects = (btnIconRect:DOMRect, selectionRect:SelectionBounds):boolean => {
        return (
            btnIconRect.right  > selectionRect.left  &&
            btnIconRect.left   < selectionRect.right &&
            btnIconRect.bottom > selectionRect.top   &&
            btnIconRect.top    < selectionRect.bottom
        );
    }
}
