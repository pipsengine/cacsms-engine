#ifndef CACSMS_MESSAGE_SERIALIZER_MQH
#define CACSMS_MESSAGE_SERIALIZER_MQH

string CacsmsEscapeJson(const string value)
{
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
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
         DoubleToString(tick.bid, digits),
         DoubleToString(tick.ask, digits),
         DoubleToString(tick.ask - tick.bid, digits)
      );
      items += (StringLen(items) ? "," : "") + item;
   }
   return "[" + items + "]";
}

string CacsmsBuildHeartbeatJson(const string token, const string eaVersion, const int latencyMs)
{
   return StringFormat(
      "{\"token\":\"%s\",\"eaVersion\":\"%s\",\"latencyMs\":%d,\"ticks\":%s}",
      CacsmsEscapeJson(token),
      CacsmsEscapeJson(eaVersion),
      latencyMs,
      CacsmsBuildLiveTicksJson()
   );
}

#endif
