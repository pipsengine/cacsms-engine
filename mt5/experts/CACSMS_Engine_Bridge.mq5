//+------------------------------------------------------------------+
//| CACSMS Engine Bridge                                             |
//+------------------------------------------------------------------+
#property copyright "CACSMS Engine"
#property version   "1.00"
#property strict

#define CACSMS_EA_VERSION "1.0.0"

#include <CACSMS/ConnectionManager.mqh>
#include <CACSMS/HeartbeatManager.mqh>
#include <CACSMS/SecurityManager.mqh>
#include <CACSMS/CommandProcessor.mqh>

input string RegistrationToken = "";
input string ApiBaseUrl = "http://localhost:8080";
input int HeartbeatSeconds = 10;

int OnInit()
{
   Print("CACSMS Engine Bridge v", CACSMS_EA_VERSION, " initialized");
   return(INIT_SUCCEEDED);
}

void OnTick()
{
}

void OnDeinit(const int reason)
{
   Print("CACSMS Engine Bridge stopped");
}
