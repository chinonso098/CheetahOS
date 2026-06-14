// User-selectable refresh speeds. The numeric value doubles as the index
// used to look up the matching interval in `refreshRate()`.
export enum RefreshRates { 
    HIGH = 3,  
    NORMAL = 2,  
    LOW = 1,  
    PAUSED = 0,  
}

// Polling intervals (in milliseconds) that correspond to each RefreshRate.
export enum RefreshRatesIntervals { 
    HIGH = 1000,      // 1 second
    NORMAL = 2000,    // 2 seconds
    LOW = 4000,       // 4 seconds
    PAUSED = 36000000, // 10 hours - effectively "paused" (no practical refresh)
 }

 // Thresholds (as a percentage) used to colour a resource-usage cell.
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