import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { Clock } from './clock';
import { Subscription, timer } from 'rxjs';
import { ComponentType } from 'src/app/system-files/component.types';
import { ProcessIDService } from 'src/app/shared/system-service/process.id.service';
import { RunningProcessService } from 'src/app/shared/system-service/running.process.service';
import { Process } from 'src/app/system-files/process';

@Component({
  selector: 'cos-clock',
  templateUrl: './clock.component.html',
  styleUrls: ['./clock.component.css']
})
export class ClockComponent implements AfterViewInit,OnDestroy {

  private _processIdService;
  private _runningProcessService;
  private _taskBarClock:Clock;
  private _timerSubscription!:Subscription;
  private _dateSubscription!:Subscription;
  
  subscribeTime!:string;
  subscribeDate!:string;

  hasWindow = false;
  hover = false;
  icon = 'osdrive/Cheetah/System/Imageres/generic_program.png';
  name = 'clock';
  processId = 0;
  type = ComponentType.System

  constructor(processIdService:ProcessIDService,runningProcessService:RunningProcessService) { 
    this._processIdService = processIdService;
    this._runningProcessService = runningProcessService;
    
    this.processId = this._processIdService.getNewProcessId()
    this._runningProcessService.addProcess(this.getComponentDetail());

    const dateTime = new Date();
    this._taskBarClock = new Clock(dateTime.getSeconds(),dateTime.getMinutes(),dateTime.getHours());
  }


  ngAfterViewInit():void {
    this.oberserableTimer();
    this.oberserableDate();
  }

  ngOnDestroy():void {
    this._timerSubscription?.unsubscribe();
    this._dateSubscription?.unsubscribe();
  }

  private oberserableTimer():void{
    this._timerSubscription = timer(50, 1000).subscribe(() => {
          this._taskBarClock.tick()
      this.subscribeTime = `${this._taskBarClock.getHourStyle('12hr')}:${this.padSingleDigits(this._taskBarClock.getMinutes)} ${this._taskBarClock.getMeridian}`;
    });
  }

  private oberserableDate():void{
    this._dateSubscription = timer(50, 360000).subscribe(() => {
      const dateTime = new Date();  
      this.subscribeDate = `${dateTime.getMonth() + 1}/${dateTime.getDate()}/${dateTime.getFullYear()}`;
    });
  }

  private padSingleDigits(n:number):string{
    return n > 9 ? "" + n: "0" + n;
  }

  private getComponentDetail():Process{
    return new Process(this.processId, this.name, this.icon, this.hasWindow, this.type)
  }

}