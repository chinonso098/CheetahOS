export interface BaseService {
  name:string,
  hasWindow:boolean,
  icon:string
  processId:number;
  type: string;
  status: string;
  description: string;
}
