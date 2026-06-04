#ifndef CACSMS_HEARTBEAT_MANAGER_MQH
#define CACSMS_HEARTBEAT_MANAGER_MQH

#include <CACSMS/ConnectionManager.mqh>
#include <CACSMS/MessageSerializer.mqh>

class CHeartbeatManager
{
private:
   CConnectionManager *m_connection;
   string m_token;
   string m_eaVersion;
   bool m_includeTicks;
   datetime m_lastSent;

public:
   CHeartbeatManager(CConnectionManager *connection, const string token, const string eaVersion, const bool includeTicks = false)
   {
      m_connection = connection;
      m_token = token;
      m_eaVersion = eaVersion;
      m_includeTicks = includeTicks;
      m_lastSent = 0;
   }

   bool SendHeartbeat(const bool force = false)
   {
      if(StringLen(m_token) == 0)
      {
         Print("CACSMS heartbeat skipped: RegistrationToken is empty.");
         return false;
      }

      const datetime now = TimeCurrent();
      if(!force && m_lastSent == now)
         return true;

      const int latencyMs = 12;
      string body = CacsmsBuildHeartbeatJson(m_token, m_eaVersion, latencyMs, m_includeTicks);
      string response;
      int httpStatus = 0;

      if(!m_connection.PostJson("/api/mt5/terminals/heartbeat", body, response, httpStatus))
      {
         Print("CACSMS heartbeat failed. HTTP=", httpStatus, " Response=", response);
         return false;
      }

      m_lastSent = now;
      Print("CACSMS heartbeat sent. HTTP=", httpStatus, " account=", StringSubstr(body, StringFind(body, "\"account\""), 80));
      return true;
   }

   datetime LastSent() const
   {
      return m_lastSent;
   }
};

#endif
