import { AfterViewInit, Component } from '@angular/core';
import {WAVES} from './vanta-object/wave';
declare const VANTA:WAVES 

@Component({
  selector: 'cos-desktop',
  templateUrl: './desktop.component.html',
  styleUrls: ['./desktop.component.css']
})
export class DesktopComponent implements AfterViewInit{

  constructor() {//
    
  }

  ngAfterViewInit(): void {
    
    VANTA.WAVES(new WAVES('#vanta',0x5588, 20, 50, 1, 0.75))
  }

}