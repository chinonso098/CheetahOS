export enum RefreshRates { 
    HIGH = 3,  
    NORMAL = 2,  
    LOW = 1,  
    PAUSED = 0,  
}

export enum RefreshRatesIntervals { 
    HIGH = 1000,   //1 second
    NOMRAL = 2000,  //2 seconds
    LOW = 4000,  //...
    PAUSED = 36000000, //24hrs
 }

 export enum ResourceUtilization { 
   LOW = 25, 
   MEDIUM = 50,
   HIGH = 75,
   VERY_HIGH = 1000,
}

 export enum TableColumns { 
    NAME = 'Name',
    STATUS = 'Status',
    CPU = 'CPU',
    MEMORY = 'Memory',
    GPU = 'GPU',
    DISK = 'Disk',
    NETWORK = 'Network',
    PID = 'PID',
    POWER_USAGE= 'Power usage',
    PROCESS_NAME = 'Process name',
    TYPE = 'Type'
 }


 export enum DisplayViews { 
    DETAILED_VIEW = 'Detailed View',
    MINI_VIEW = 'Mini View'
 }