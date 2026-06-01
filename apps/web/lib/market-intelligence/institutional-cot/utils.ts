export const formatContracts=(value:number)=>`${value>=0?"+":""}${value.toLocaleString()}`;
export const biasTone=(bias:string)=>bias.toLowerCase().replaceAll(" ","-");
