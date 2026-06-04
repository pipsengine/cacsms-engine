#!/usr/bin/env node
import { loadEnvFile } from "./load-env.mjs";
import { purgeLegacyMockPortfolioRows } from "../packages/market-intelligence/src/portfolio-live-data.js";

loadEnvFile();
const result = await purgeLegacyMockPortfolioRows();
console.log(`[purge-mock-portfolio] removed ${result.removedAccounts} legacy account row(s) without MT5 terminal link`);
