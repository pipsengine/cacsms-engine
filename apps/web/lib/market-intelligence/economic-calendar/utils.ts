export const restrictionMinutes=(impact:string)=>impact==="CRITICAL"?60:impact==="HIGH"?30:impact==="MEDIUM"?15:0;
