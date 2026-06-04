"use client";

import React from "react";

export function PropComplianceIntegration({ accounts = [] }: { accounts?: { id: string; accountName: string; brokerName: string }[] }) {
  const funded = accounts.filter((a) => /ftmo|funded|prop|challenge|evaluation/i.test(`${a.brokerName} ${a.accountName}`));
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Prop Firm Compliance Integration</h2>
      <p className="text-sm text-slate-400">Daily loss, max drawdown, and firm rules from linked prop-firm accounts in production storage only.</p>
      {!funded.length ? (
        <p className="text-sm text-slate-500">No prop firm account linked. Connect an account on Prop Firm Rules to monitor compliance.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {funded.map((a) => (
            <article key={a.id} className="border border-slate-700 rounded-lg p-4">
              <h3 className="font-medium text-white">{a.accountName}</h3>
              <p className="text-xs text-slate-500 mb-3">{a.brokerName}</p>
              <p className="text-xs text-slate-500">Metrics load from linked production accounts.</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
