import { ComponentType } from "src/app/system-files/system.types";
export interface BaseComponent {
  confirm?: any;
  cancel?: any;
  name:string,
  hasWindow:boolean,
  isMaximizable?:boolean,
  icon:string
  processId:number;
  type: ComponentType;
  displayName: string;
}
