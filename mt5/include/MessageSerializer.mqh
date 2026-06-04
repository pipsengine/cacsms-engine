#ifndef CACSMS_MESSAGE_SERIALIZER_MQH
#define CACSMS_MESSAGE_SERIALIZER_MQH

string CacsmsEscapeJson(const string value)
{
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   return out;
}

string CacsmsJsonNumber(const double value, const int digits = 2)
{
   string out = DoubleToString(value, digits);
   StringReplace(out, " ", "");
   StringReplace(out, ",", ".");
   return out;
}

string CacsmsBuildLiveTicksJson(const int maxSymbols = 20)
{
   string items = "";
   const int total = MathMin(SymbolsTotal(true), maxSymbols);
   for(int index = 0; index < total; index++)
   {
      const string symbol = SymbolName(index, true);
      MqlTick tick;
      if(!SymbolInfoTick(symbol, tick) || tick.bid <= 0 || tick.ask <= 0)
         continue;
      const int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      const string item = StringFormat(
         "{\"symbol\":\"%s\",\"bid\":%s,\"ask\":%s,\"spread\":%s}",
         CacsmsEscapeJson(symbol),
         CacsmsJsonNumber(tick.bid, digits),
         CacsmsJsonNumber(tick.ask, digits),
         CacsmsJsonNumber(tick.ask - tick.bid, digits)
      );
      items += (StringLen(items) ? "," : "") + item;
   }
   return "[" + items + "]";
}

string CacsmsBuildOpenPositionsJson(const int maxPositions = 32)
{
   string items = "";
   const int total = MathMin(PositionsTotal(), maxPositions);
   for(int index = 0; index < total; index++)
   {
      const ulong ticket = PositionGetTicket(index);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      const string symbol = PositionGetString(POSITION_SYMBOL);
      const long type = PositionGetInteger(POSITION_TYPE);
      const string direction = (type == POSITION_TYPE_SELL) ? "Sell" : "Buy";
      const int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      const string item = StringFormat(
         "{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"direction\":\"%s\",\"volume\":%s,\"entryPrice\":%s,\"currentPrice\":%s,\"profit\":%s,\"sl\":%s,\"tp\":%s}",
         ticket,
         CacsmsEscapeJson(symbol),
         direction,
         CacsmsJsonNumber(PositionGetDouble(POSITION_VOLUME), 2),
         CacsmsJsonNumber(PositionGetDouble(POSITION_PRICE_OPEN), digits),
         CacsmsJsonNumber(PositionGetDouble(POSITION_PRICE_CURRENT), digits),
         CacsmsJsonNumber(PositionGetDouble(POSITION_PROFIT), 2),
         CacsmsJsonNumber(PositionGetDouble(POSITION_SL), digits),
         CacsmsJsonNumber(PositionGetDouble(POSITION_TP), digits)
      );
      items += (StringLen(items) ? "," : "") + item;
   }
   return "[" + items + "]";
}

string CacsmsBuildAccountJson()
{
   const double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   const double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   const double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   const double profit = AccountInfoDouble(ACCOUNT_PROFIT);
   const long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   return StringFormat(
      "{\"balance\":%s,\"equity\":%s,\"margin\":%s,\"freeMargin\":%s,\"floatingPL\":%s,\"currency\":\"%s\",\"leverage\":%I64d}",
      CacsmsJsonNumber(balance, 2),
      CacsmsJsonNumber(equity, 2),
      CacsmsJsonNumber(margin, 2),
      CacsmsJsonNumber(freeMargin, 2),
      CacsmsJsonNumber(profit, 2),
      CacsmsEscapeJson(AccountInfoString(ACCOUNT_CURRENCY)),
      leverage
   );
}

string CacsmsBuildHeartbeatJson(const string token, const string eaVersion, const int latencyMs, const bool includeTicks = false)
{
   const string ticks = includeTicks ? CacsmsBuildLiveTicksJson() : "[]";
   return StringFormat(
      "{\"token\":\"%s\",\"eaVersion\":\"%s\",\"latencyMs\":%d,\"account\":%s,\"openPositions\":%s,\"ticks\":%s}",
      CacsmsEscapeJson(token),
      CacsmsEscapeJson(eaVersion),
      latencyMs,
      CacsmsBuildAccountJson(),
      CacsmsBuildOpenPositionsJson(),
      ticks
   );
}

#endif
