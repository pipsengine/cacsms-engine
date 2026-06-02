#ifndef CACSMS_MESSAGE_SERIALIZER_MQH
#define CACSMS_MESSAGE_SERIALIZER_MQH

string CacsmsEscapeJson(const string value)
{
   string out = value;
   StringReplace(out, "\\", "\\\\");
   StringReplace(out, "\"", "\\\"");
   return out;
}

string CacsmsBuildHeartbeatJson(const string token, const string eaVersion, const int latencyMs)
{
   return StringFormat(
      "{\"token\":\"%s\",\"eaVersion\":\"%s\",\"latencyMs\":%d}",
      CacsmsEscapeJson(token),
      CacsmsEscapeJson(eaVersion),
      latencyMs
   );
}

#endif
