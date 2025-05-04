import {trigger, transition, state, animate, style, keyframes} from '@angular/animations';
    
//const HIDDEN_Z_INDEX = 0;
//const MIN_Z_INDEX = 1;
const MAX_Z_INDEX = 2;

  // Routable animations
    export const openCloseAnimation = trigger('openClose', [
        state('open', style({ 
            opacity: 1,
            zIndex: MAX_Z_INDEX,
        })),
        state('close', style({ 
            opacity: 0
        })),
        transition('open => *', [
            animate("0.45s cubic-bezier(0.4, 0, 0.2, 1)", keyframes([
                style({ transform: '{{wt0p}}', opacity: 1, offset: 0 }),
                style({ transform: '{{wt50p}}', opacity: 0.5, offset: 0.5 }),
                style({ transform: '{{wt100p}}', opacity: 0, offset: 1 })
            ]))
        ], { params: { wt0p: 'translate(0,0)', wt50p: 'translate(-50px,50px)', wt100p: 'translate(-100px,100px)' } }),
        transition('* => open', [
            animate("0.45s cubic-bezier(0.4, 0, 0.2, 1)", keyframes([
                style({ transform: '{{wt100p}}', opacity: 0, offset: 0 }),
                style({ transform: '{{wt50p}}', opacity: 0.5, offset: 0.5 }),
                style({ transform: '{{wt0p}}', opacity: 1, offset: 1 })
            ]))
        ], { params: { wt0p: 'translate(0,0)', wt50p: 'translate(-50px,50px)', wt100p: 'translate(-100px,100px)' } })
    ]);

    export const hideShowAnimation =
        trigger('hideShow', [
            state('hidden', style({
                opacity: 0,
            })),
            state('visible', style({
                opacity: 1,
            })),
            transition('visible => hidden', [
                animate("0.45s cubic-bezier(0.4, 0, 0.2, 1)", keyframes([
                    style({ transform: '{{yAxis0p}}', opacity: 1, offset: 0}),
                    style({ transform: '{{yAxis50p}}', opacity: 0.50,  offset: 0.5}),
                    style({ transform: '{{yAxis100p}}', opacity: 0,  offset: 1})
                ]))
            ],{params:{ yAxis0p: 'translate(0, 0)', yAxis50p: 'translate(0, 50px)', yAxis100p:'translate(0, 100px)'}}),
            transition('hidden => visible', [
                animate("0.45s cubic-bezier(0.4, 0, 0.2, 1)", keyframes([            
                    style({ transform: '{{yAxis100p}}', opacity: 0, offset: 0}),
                    style({ transform: '{{yAxis50p}}', opacity: 0.50, offset: 0.5}),
                    style({ transform: '{{yAxis0p}}', opacity: 1, offset: 1 })
                ]))
            ],{params:{ yAxis0p: 'translate(0, 0)', yAxis50p: 'translate(0, 50px)', yAxis100p:'translate(0, 100px)'}})
        ]);
    

    export const minimizeMaximizeAnimation =
        trigger('minimizeMaximize', [
            state('minimized', style({
                opacity: 1,
                width :'{{winWidth}}',
                height : '{{winHeight}}',
                transform : '{{winTransform}}', 
                zIndex: '{{winZIndex}}',
            }),{params:{ winWidth: '',winHeight: '', winTransform: '', winZIndex:''}}),
            state('maximized', style({
                opacity: 1,
                width :'100%',
                height : 'calc(100% - 40px)',
                left : 0,
                right : 0,
                top : 0,
                bottom : 0,
                transform : 'translate(0,0)',
                zIndex: '{{winZIndex}}',
            }),{params:{winZIndex:''}}),
            transition('minimized => maximized', animate('0.50s ease-out')),
            transition('maximized => minimized', animate('0.50s ease-in')),
        ]);