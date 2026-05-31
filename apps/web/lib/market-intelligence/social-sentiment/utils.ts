export const crowdTone=(risk:string)=>risk==="Manipulation Risk"?"danger":risk.includes("Spike")||risk.includes("Crowded")?"warning":"success";
