import {trigger, transition, state, animate, style, keyframes} from '@angular/animations';
    
const HIDDEN_Z_INDEX = 1;
const MAX_Z_INDEX = 2;

  // Routable animations
    export const openCloseAnimation =
        trigger('openClose', [
            state('open', style({ 
                opacity: 1,
                zIndex: MAX_Z_INDEX,
            })),
            state('close',  style({ 
                opacity: 0
            })),
            transition('open => *', [
                animate("0.30s ease-out", keyframes([
                    style({ transform: '{{wt0p}}', opacity: 1 }),
                    style({ transform: '{{wt25p}}', opacity: 0.75}),
                    style({ transform: '{{wt50p}}', opacity: 0.50}),
                    style({ transform: '{{wt75p}}', opacity: 0.25 }),
                    style({ transform: '{{wt100p}}', opacity: 0 })
                ]))
            ],{params:{ wt0p: 'translate(0,0)',wt25p: 'translate(-25px,25px)', wt50p: 'translate(-50px,50px)', wt75p:'translate(-75px,75px)', wt100p:'translate(-100px,100px)'}}),
            transition('* => open', [
                animate("0.30s ease-in", keyframes([            
                    style({ transform: '{{wt100p}}', opacity: 0 }),
                    style({ transform: '{{wt75p}}', opacity: 0.25 }),
                    style({ transform: '{{wt50p}}', opacity: 0.50}),
                    style({ transform: '{{wt25p}}', opacity: 0.75}),
                    style({ transform: '{{wt0p}}', opacity: 1 })
                ]))
            ],{params:{ wt0p: 'translate(0,0)',wt25p: 'translate(-25px,25px)', wt50p: 'translate(-50px,50px)', wt75p:'translate(-75px,75px)', wt100p:'translate(-100px,100px)'}})
        ]);


    export const hideShowAnimation =
        trigger('hideShow', [
            state('hidden', style({
                opacity: 0,
                zIndex: HIDDEN_Z_INDEX,
            })),
            state('visible', style({
                opacity: 1,
                zIndex: MAX_Z_INDEX,
            })),
            transition('visible => hidden', [
                animate("0.30s ease-out", keyframes([
                    style({ transform: '{{yAxis0p}}', opacity: 1 }),
                    style({ transform: '{{yAxis25p}}', opacity: 0.75}),
                    style({ transform: '{{yAxis50p}}', opacity: 0.50}),
                    style({ transform: '{{yAxis75p}}', opacity: 0.25 }),
                    style({ transform: '{{yAxis100p}}', opacity: 0 })
                ]))
            ],{params:{ yAxis0p: 'translate(0, 0)',yAxis25p: 'translate(0, 25px)', yAxis50p: 'translate(0, 50px)', yAxis75p:'translate(0, 75px)', yAxis100p:'translate(0, 100px)'}}),
            transition('hidden => visible', [
                animate("0.30s ease-in", keyframes([            
                    style({ transform: '{{yAxis100p}}', opacity: 0 }),
                    style({ transform: '{{yAxis75p}}', opacity: 0.25 }),
                    style({ transform: '{{yAxis50p}}', opacity: 0.50}),
                    style({ transform: '{{yAxis25p}}', opacity: 0.75}),
                    style({ transform: '{{yAxis0p}}', opacity: 1 })
                ]))
            ],{params:{ yAxis0p: 'translate(0, 0)',yAxis25p: 'translate(0, 25px)', yAxis50p: 'translate(0, 50px)', yAxis75p:'translate(0, 75px)', yAxis100p:'translate(0, 100px)'}})
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