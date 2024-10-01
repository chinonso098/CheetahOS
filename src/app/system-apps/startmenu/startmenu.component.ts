import { Component, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { ComponentType } from 'src/app/system-files/component.types';
import { Process } from 'src/app/system-files/process';
import { Constants } from 'src/app/system-files/constants';

@Component({
  selector: 'cos-startmenu',
  templateUrl: './startmenu.component.html',
  styleUrls: ['./startmenu.component.css']
})
export class StartMenuComponent implements OnInit, AfterViewInit {
  private _processIdService:ProcessIDService;
  private _runningProcessService:RunningProcessService;

  private _elRef:ElementRef;
  private _consts:Constants = new Constants();
  txtOverlayMenuStyle:Record<string, unknown> = {};
  private SECONDS_DELAY = 250;

  hasWindow = false;
  icon = `${this._consts.IMAGE_BASE_PATH}generic_program.png`;
  name = 'startmenu';
  processId = 0;
  type = ComponentType.System
  displayName = '';

  constructor( processIdService:ProcessIDService,runningProcessService:RunningProcessService, elRef: ElementRef) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    this._elRef = elRef;

    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());
  }

  ngOnInit(): void {
    1 
  }
  
  ngAfterViewInit(): void {
    this.removeVantaJSSideEffect();
  }

  /**
   * NOTE:This method is temporary for the start menu
   */
  removeVantaJSSideEffect(): void {
    // VANTA js wallpaper is adding an unwanted style position:relative and z-index:1
    setTimeout(()=> {
      const elfRef = this._elRef.nativeElement;
      if(elfRef) {
        elfRef.style.position = '';
        elfRef.style.zIndex = '';
      }
    }, this.SECONDS_DELAY);
  }



  // slideIn():void{
  //   const smTxtOverlay = document.getElementById('sm-Text-Overlay') as HTMLElement;
  //   if(smTxtOverlay){
  //     smTxtOverlay.style.display = 'block';
  //     smTxtOverlay.style.left = '48px';
  //     smTxtOverlay.style.transition = '1s ease';
  //   }
  // }


  // slideIn(): void {
  //   const smTxtOverlay = document.getElementById('sm-Text-Overlay') as HTMLElement;
    
  //   if (smTxtOverlay) {
  //     // Set initial position and visibility
  //     smTxtOverlay.style.left = '-152px';
  //     smTxtOverlay.style.display = 'block'; // Make it visible first

  //     // Allow the browser to calculate the layout before applying the animation
  //     setTimeout(() => {
  //         smTxtOverlay.style.transition = 'left 1s ease'; // Set the transition for left
  //         smTxtOverlay.style.left = '48px'; // Animate to 48px
  //     }, 0); // Use a small timeout to ensure styles are applied in the correct order
  //   } 
  // }

  startMenuOverlaySlideOut(): void {
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;
  
    if (smIconTxtOverlay) {
      // Set initial position and visibility
      smIconTxtOverlay.style.width = '48px';
      // Allow the browser to calculate the layout before applying the animation
      setTimeout(() => {
        smIconTxtOverlay.style.transition = 'width 0.45s ease'; // Set the transition for left
        smIconTxtOverlay.style.width = '250px'; // Animate to 250px
        smIconTxtOverlay.style.boxShadow = '0px 2px 4px rgba(0, 0, 0, 0.6)';
        //smIconTxtOverlay.style.clipPath = 'inset(0px -10px -10px -10px)';

        this.txtOverlayMenuStyle = {
          'display': 'block'
        }
      }, 0); // Use a small timeout to ensure styles are applied in the correct order
    } 
  }

  startMenuOverlaySlideIn(): void {
    const smIconTxtOverlay = document.getElementById('sm-IconText-Overlay-Cntnr') as HTMLElement;

    if (smIconTxtOverlay) {
      // Ensure the element has the transition property set for smooth animation
      smIconTxtOverlay.style.transition = 'width 0.75s ease';
      smIconTxtOverlay.style.width = '48px';
      smIconTxtOverlay.style.boxShadow = 'none';

      // After the transition ends, hide the element
      setTimeout(() => {
        this.txtOverlayMenuStyle = {
          'display': 'none'
        }
      }, 300); // Set this to match the transition duration (1s)
    }
  }



  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }
}
