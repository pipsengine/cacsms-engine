import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { BarChart3, Maximize2, Download } from "lucide-react";

export function EquityGrowthAnalytics({ data }: { data: number[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data?.length) return;

    const chart = echarts.init(chartRef.current);
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f172a",
        borderColor: "#1e293b",
        textStyle: { color: "#f1f5f9" },
        axisPointer: { lineStyle: { color: "#334155" } }
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "10%",
        containLabel: true
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((_, i) => i),
        axisLine: { lineStyle: { color: "#334155" } },
        axisLabel: { show: false }
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#1e293b" } },
        axisLabel: { color: "#64748b", fontSize: 10 }
      },
      series: [
        {
          name: "Portfolio Equity",
          type: "line",
          data: data,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59, 130, 246, 0.3)" },
              { offset: 1, color: "rgba(59, 130, 246, 0)" }
            ])
          }
        }
      ]
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">Portfolio Equity Analytics</h3>
            <p className="text-xs text-slate-400">Consolidated balance and equity curve performance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-[10px] font-bold">
            {["1D", "1W", "1M", "3M", "6M", "1Y", "ALL"].map(p => (
              <button key={p} className={`px-2 py-1 rounded ${p === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {p}
              </button>
            ))}
          </div>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 border border-slate-700"><Maximize2 className="w-4 h-4" /></button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 border border-slate-700"><Download className="w-4 h-4" /></button>
        </div>
      </div>

      <div ref={chartRef} className="w-full h-[300px]"></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Net Profit</span>
          <div className="text-lg font-bold text-green-500">+$12,482.40</div>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Profit Factor</span>
          <div className="text-lg font-bold text-blue-400">1.84</div>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Recovery Factor</span>
          <div className="text-lg font-bold text-purple-400">4.12</div>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Expectancy</span>
          <div className="text-lg font-bold text-slate-200">$42.18</div>
        </div>
      </div>
    </div>
  );
}
