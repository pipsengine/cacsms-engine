export const sentimentBand=(score:number)=>score<=30?"Strong Risk-Off":score<=45?"Risk-Off":score<=55?"Neutral":score<=70?"Risk-On":"Strong Risk-On";
