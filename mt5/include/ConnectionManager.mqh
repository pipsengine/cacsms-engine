#ifndef CACSMS_CONNECTION_MANAGER_MQH
#define CACSMS_CONNECTION_MANAGER_MQH

class CConnectionManager
{
private:
   string m_baseUrl;

public:
   CConnectionManager(const string baseUrl)
   {
      m_baseUrl = baseUrl;
      while(StringLen(m_baseUrl) > 0 && StringSubstr(m_baseUrl, StringLen(m_baseUrl) - 1, 1) == "/")
         m_baseUrl = StringSubstr(m_baseUrl, 0, StringLen(m_baseUrl) - 1);
   }

   bool PostJson(const string path, const string body, string &response, int &httpStatus)
   {
      string url = m_baseUrl + path;
      char data[];
      char result[];
      string resultHeaders;
      string requestHeaders = "Content-Type: application/json\r\n";

      int bytes = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
      if(bytes <= 0)
         return false;
      ArrayResize(data, bytes - 1);

      ResetLastError();
      httpStatus = WebRequest("POST", url, requestHeaders, 5000, data, result, resultHeaders);
      if(httpStatus == -1)
      {
         Print("CACSMS WebRequest failed. Add ", m_baseUrl, " to Tools -> Options -> Expert Advisors -> WebRequest URLs. Error=", GetLastError());
         return false;
      }

      response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      return httpStatus >= 200 && httpStatus < 300;
   }
};

#endif
