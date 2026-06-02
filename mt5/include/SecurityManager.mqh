#ifndef CACSMS_SECURITY_MANAGER_MQH
#define CACSMS_SECURITY_MANAGER_MQH

bool CacsmsValidateRegistrationToken(const string token)
{
   if(StringLen(token) < 12)
      return false;
   return StringFind(token, "CACSMS-MT5-REG-") == 0;
}

#endif
