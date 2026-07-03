import {trigger, transition, state, animate, style, keyframes} from '@angular/animations';
    
  // Routable animations
    export const openCloseAnimation = trigger('openClose', [
        state('open', style({ 
            opacity: 1,
            zIndex: 2,
        })),
        state('close', style({ 
            opacity: 0
        })),
        transition('open => *', [
            animate("0.18s cubic-bezier(0.4, 0, 1, 1)", keyframes([
                style({ transform: '{{wt0p}} scale(1)', opacity: 1, offset: 0 }),
                style({ transform: '{{wt50p}} scale(0.75)', opacity: 0.5, offset: 0.5 }),
                style({ transform: '{{wt100p}} scale(0.45)', opacity: 0, offset: 1 })
            ]))
        ], { params: { wt0p: 'translate(0,0)', wt50p: 'translate(-50px,50px)', wt100p: 'translate(-100px,100px)' } }),
        transition('* => open', [
            animate("0.2s cubic-bezier(0, 0, 0.2, 1)", keyframes([
                style({ transform: '{{wt100p}} scale(0.45)', opacity: 0, offset: 0 }),
                style({ transform: '{{wt50p}} scale(0.75)', opacity: 0.5, offset: 0.5 }),
                style({ transform: '{{wt0p}} scale(1)', opacity: 1, offset: 1 })
            ]))
        ], { params: { wt0p: 'translate(0,0)', wt50p: 'translate(-50px,50px)', wt100p: 'translate(-100px,100px)' } })
    ]);


    export const hideShowAnimation =  trigger('hideShow', [
            state('hidden', style({
            opacity: 0,
            transform: '{{t100}}',
            }), { params: { t100: 'translate(0, 140px) scale(0.7)' } }),

            state('visible', style({
            opacity: 1,
            transform: '{{t0}}',
            }), { params: { t0: 'translate(0, 0) scale(1)' } }),

            transition('visible => hidden', [
            animate('0.22s cubic-bezier(0.4, 0, 1, 1)', keyframes([
                style({ transform: '{{t0}}',   opacity: 1,    offset: 0   }),
                style({ transform: '{{t50}}',  opacity: 0.6,  offset: 0.6 }),
                style({ transform: '{{t100}}', opacity: 0,    offset: 1   }),
            ])),
            ], {
            params: {
                t0: 'translate(0, 0) scale(1)',
                t50: 'translate(0, 80px) scale(0.82)',
                t100: 'translate(0, 140px) scale(0.7)',
            }
            }),

            transition('hidden => visible', [
            animate('0.24s cubic-bezier(0, 0, 0.2, 1)', keyframes([
                style({ transform: '{{t100}}', opacity: 0,    offset: 0   }),
                style({ transform: '{{t50}}',  opacity: 0.6,  offset: 0.4 }),
                style({ transform: '{{t0}}',   opacity: 1,    offset: 1   }),
            ])),
            ], {
            params: {
                t0: 'translate(0, 0) scale(1)',
                t50: 'translate(0, 80px) scale(0.82)',
                t100: 'translate(0, 140px) scale(0.7)',
            }
        }),
    ]);


    /**
     * Maximize / restore animation.
     *
     * Geometry notes:
     *   - The window host element is `position: absolute` inside
     *     `.ol-desktopIcon-grid` (the nearest positioned ancestor), which is
     *     already sized to `calc(100vh - 40px)` to exclude the taskbar.
     *     Therefore `height: 100%` in the maximized state already stops at the
     *     top of the taskbar - subtracting another 40px would leave a gap.
     *
     *   - The `restore` state explicitly restores `left` and `top` via the
     *     `winLeft` / `winTop` params. Without these, the inline `left:0;top:0`
     *     written by the maximized state would linger after the transition
     *     (Angular's animation engine does not clear properties that aren't
     *     present in the target state, and ngStyle's KeyValueDiffer cannot
     *     detect "no change" in the bound object to force a re-write).
     */
    export const maximizeRestoreAnimation = trigger('maximizeRestore', [
        state('restore', style({
            opacity: 1,
            width :'{{winWidth}}',
            height : '{{winHeight}}',
            left : '{{winLeft}}',
            top : '{{winTop}}',
            transform : '{{winTransform}}',
            zIndex: '{{winZIndex}}',
        }),{params:{ winWidth: '',winHeight: '', winLeft: '0px', winTop: '0px', winTransform: '', winZIndex:''}}),
        state('maximized', style({
            opacity: 1,
            width :'100%',
            height : '100%',
            left : 0,
            right : 0,
            top : 0,
            bottom : 0,
            transform : 'translate(0,0)',
            zIndex: '{{winZIndex}}',
        }),{params:{winZIndex:''}}),
        transition('restore => maximized', animate('0.2s cubic-bezier(0, 0, 0.2, 1)')),
        transition('maximized => restore', animate('0.2s cubic-bezier(0.4, 0, 1, 1)')),
    ]);