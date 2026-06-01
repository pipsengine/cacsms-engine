export const PROP_FIRM_RULES=Object.freeze([
 {id:"ftmo-100k-p1",firmName:"FTMO",accountSize:100000,accountType:"Challenge",phase:"Phase 1",profitTargetPercent:10,dailyLossLimitPercent:5,maxDrawdownPercent:10,minTradingDays:4,maxTradingDays:0,newsTradingAllowed:true,weekendHoldingAllowed:true,eaAllowed:true,copyTradingAllowed:false,payoutSplitPercent:90,payoutCycle:"14 days",consistencyRule:"None",leverage:"1:100",status:"Active"},
 {id:"fn-50k-eval",firmName:"FundedNext",accountSize:50000,accountType:"Evaluation",phase:"Phase 1",profitTargetPercent:8,dailyLossLimitPercent:5,maxDrawdownPercent:10,minTradingDays:5,maxTradingDays:0,newsTradingAllowed:true,weekendHoldingAllowed:true,eaAllowed:true,copyTradingAllowed:true,payoutSplitPercent:95,payoutCycle:"14 days",consistencyRule:"40% max daily profit",leverage:"1:100",status:"Active"},
 {id:"t5-100k-funded",firmName:"The5ers",accountSize:100000,accountType:"Funded",phase:"Funded",profitTargetPercent:0,dailyLossLimitPercent:5,maxDrawdownPercent:10,minTradingDays:0,maxTradingDays:0,newsTradingAllowed:true,weekendHoldingAllowed:true,eaAllowed:true,copyTradingAllowed:false,payoutSplitPercent:100,payoutCycle:"14 days",consistencyRule:"None",leverage:"1:100",status:"Active"},
 {id:"e8-50k-p2",firmName:"E8 Markets",accountSize:50000,accountType:"Evaluation",phase:"Phase 2",profitTargetPercent:5,dailyLossLimitPercent:5,maxDrawdownPercent:8,minTradingDays:0,maxTradingDays:0,newsTradingAllowed:false,weekendHoldingAllowed:true,eaAllowed:true,copyTradingAllowed:false,payoutSplitPercent:80,payoutCycle:"14 days",consistencyRule:"None",leverage:"1:50",status:"Under Review"},
]);
export const PROP_FIRM_COMPLIANCE_ACCOUNTS=Object.freeze([
 {id:"prop-ftmo-02",accountName:"PROP-FTMO-02",firmName:"FTMO",phase:"Phase 1",balance:25000,equity:25418,dailyLossUsedPercent:16,maxDrawdownUsedPercent:14,profitTargetProgressPercent:74,minimumDaysCompleted:4,breachRisk:"Low",status:"Compliant"},
 {id:"prop-fn-03",accountName:"PROP-FN-03",firmName:"FundedNext",phase:"Phase 1",balance:15240,equity:15220,dailyLossUsedPercent:12,maxDrawdownUsedPercent:13,profitTargetProgressPercent:45,minimumDaysCompleted:3,breachRisk:"Medium",status:"Watchlist"},
 {id:"prop-e8-04",accountName:"PROP-E8-04",firmName:"E8 Markets",phase:"Phase 2",balance:50110,equity:48280,dailyLossUsedPercent:72,maxDrawdownUsedPercent:61,profitTargetProgressPercent:62,minimumDaysCompleted:2,breachRisk:"High",status:"At Risk"},
]);
export const PROP_FIRM_COMPARISON=Object.freeze([
 ["FTMO","EUR 540","10%","5%","10%","Up to $2M","90%","Refund after first payout","Allowed","Allowed","None","1:100","FX / metals / indices / crypto"],
 ["FundedNext","USD 299","8%","5%","10%","Up to $4M","95%","Refund available","Allowed","Allowed","40% daily profit","1:100","FX / metals / indices"],
 ["The5ers","USD 495","0% funded","5%","10%","Up to $4M","100%","Program dependent","Allowed","Allowed","None","1:100","FX / metals / indices"],
 ["E8 Markets","USD 358","5% P2","5%","8%","Up to $1M","80%","Program dependent","Restricted","Allowed","None","1:50","FX / metals / indices"],
]);
export const PROP_FIRM_BREACH_ALERTS=Object.freeze([
 ["Daily loss close to limit","High","PROP-E8-04","72% utilized","Reduce size and block new correlated trades"],
 ["Max drawdown close to limit","High","PROP-E8-04","61% utilized","Require compliance review before execution"],
 ["News trading restriction","Medium","PROP-E8-04","USD CPI window armed","Block affected symbols T-2m / T+2m"],
 ["Consistency rule warning","Medium","PROP-FN-03","34% of profit from best day","Keep below 40% policy threshold"],
 ["Minimum trading day gap","Low","PROP-FN-03","3 / 5 days completed","Continue compliant daily activity"],
 ["Weekend holding warning","Low","PROP-FTMO-02","2 positions open Friday","Review exposure before rollover"],
]);
export function getPropFirmRulesDashboard(){return{rules:PROP_FIRM_RULES,comparison:PROP_FIRM_COMPARISON,compliance:PROP_FIRM_COMPLIANCE_ACCOUNTS,breachAlerts:PROP_FIRM_BREACH_ALERTS,summary:{totalPropFirms:4,activeAccounts:3,accountsNearBreach:1,breachedAccounts:0,averageDailyLossLimit:5,averageMaxDrawdown:9.5,minimumTradingDays:4,nextPayoutDue:"2026-06-14"}}}
