/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { Constants } from 'src/app/system-files/constants';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-greeting',
  templateUrl: './greeting.component.html',
  styleUrls: ['./greeting.component.css'],
  standalone:false,
})
export class GreetingComponent implements OnInit, BaseComponent {
  @Input() priorUId = Constants.EMPTY_STRING;
  
  hasWindow = true;
  icon = 'favicon.ico';
  name = 'greeting';
  processId = 0;
  type = ComponentType.User;
  displayName = Constants.EMPTY_STRING;

  constructor() {
    //
   }

  ngOnInit(): void {
    1
  }

}
