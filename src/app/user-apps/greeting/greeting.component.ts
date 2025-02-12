import { Component, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/system-base/base/base.component.interface';
import { ComponentType } from 'src/app/system-files/system.types';

@Component({
  selector: 'cos-greeting',
  templateUrl: './greeting.component.html',
  styleUrls: ['./greeting.component.css']
})
export class GreetingComponent implements OnInit, BaseComponent {

  hasWindow = true;
  icon = 'favicon.ico';
  name = 'greeting';
  processId = 0;
  type = ComponentType.User;
  displayName = '';
  constructor() {
    //
   }

  ngOnInit(): void {
    1
  }

}
