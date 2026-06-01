"""Download CFTC Historical Compressed legacy Futures Only files."""
from datetime import datetime
from urllib.request import Request, urlopen

COT_SOURCE_URL = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm"
COT_LEGACY_YEAR_URL = "https://www.cftc.gov/files/dea/history/deacot{year}.zip"

class CotDownloadService:
    def __init__(self, timeout=30):
        self.timeout = timeout

    def download_year(self, year):
        url = COT_LEGACY_YEAR_URL.format(year=int(year))
        request = Request(url, headers={"User-Agent": "CACSMS-Engine/1.0 COT sync"})
        with urlopen(request, timeout=self.timeout) as response:
            return {"year": int(year), "url": url, "content_type": response.headers.get_content_type(), "content": response.read()}

    def download_latest_futures_only(self):
        return self.download_year(datetime.utcnow().year)
