export const statusTone = (value: string) => value === "BLOCKED" || value === "FAILED" ? "danger" : value === "RESTRICTED" || value === "WARNING" ? "warning" : "success";
export const formatLatency = (value: number) => value ? `${value}ms` : "Scheduled";
