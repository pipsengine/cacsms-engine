//+------------------------------------------------------------------+
//| CACSMS Engine Bridge                                             |
//+------------------------------------------------------------------+
#property copyright "CACSMS Engine"
#property version   "1.02"
#property strict

#define CACSMS_EA_VERSION "1.0.2"

#include <CACSMS/SecurityManager.mqh>
#include <CACSMS/ConnectionManager.mqh>
#include <CACSMS/HeartbeatManager.mqh>
#include <CACSMS/CommandProcessor.mqh>

input string RegistrationToken = "";
input string ApiBaseUrl = "http://127.0.0.1:8080";
input int HeartbeatSeconds = 10;

CConnectionManager *g_connection = NULL;
CHeartbeatManager *g_heartbeat = NULL;

int OnInit()
{
   if(!CacsmsValidateRegistrationToken(RegistrationToken))
   {
      Print("CACSMS Engine Bridge: invalid RegistrationToken. Generate a token in Market Data Providers.");
      return(INIT_PARAMETERS_INCORRECT);
   }

   g_connection = new CConnectionManager(ApiBaseUrl);
   g_heartbeat = new CHeartbeatManager(g_connection, RegistrationToken, CACSMS_EA_VERSION);

   if(!g_heartbeat.SendHeartbeat(true))
      Print("CACSMS Engine Bridge: initial heartbeat failed. Check WebRequest URL whitelist for ", ApiBaseUrl);

   EventSetTimer(MathMax(HeartbeatSeconds, 5));
   Print("CACSMS Engine Bridge v", CACSMS_EA_VERSION, " initialized");
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_heartbeat != NULL) { delete g_heartbeat; g_heartbeat = NULL; }
   if(g_connection != NULL) { delete g_connection; g_connection = NULL; }
   Print("CACSMS Engine Bridge stopped");
}

void OnTimer()
{
   if(g_heartbeat != NULL)
      g_heartbeat.SendHeartbeat(true);
}

void OnTick()
{
   if(g_heartbeat != NULL)
      g_heartbeat.SendHeartbeat();
}
