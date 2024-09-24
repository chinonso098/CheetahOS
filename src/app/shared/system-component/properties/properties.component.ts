import {ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import { ComponentType } from 'src/app/system-files/component.types';
@Component({
  selector: 'cos-properties',
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css'
})

export class PropertiesComponent implements OnChanges {

  @Input() inputMsg = '';

  propertiesId = 0;
  type = ComponentType.System;
  displayMgs = 'Test Test Properties';
  name = 'Test Test';

  constructor(private changeDetectorRef: ChangeDetectorRef){
    this.propertiesId = this.generatePropertyId();
  }


  ngOnChanges(changes: SimpleChanges):void{
    //console.log('DIALOG onCHANGES:',changes);
    this.displayMgs = this.inputMsg;
  }


  onCloseDialogBox():void{
    //this._notificationServices.closeDialogBoxNotify.next(this.propertyId);
  }

  private generatePropertyId(): number{
    const min = Math.ceil(500);
    const max = Math.floor(999);
    return Math.floor(Math.random() * (max - min + 1)) + min; 
  }

}
