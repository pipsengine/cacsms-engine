"""Parse legacy Futures Only CFTC compressed records."""
import csv
import io
import zipfile

def _integer(row, *keys):
    for key in keys:
        value = row.get(key)
        if value not in (None, ""):
            return int(str(value).replace(",", "").strip())
    return 0

class CotParserService:
    def parse(self, raw_file):
        with zipfile.ZipFile(io.BytesIO(raw_file["content"])) as archive:
            name = next(item for item in archive.namelist() if item.lower().endswith((".txt", ".csv")))
            with archive.open(name) as source:
                rows = csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig"))
                return [self._normalize(row, raw_file["year"], name) for row in rows]

    def _normalize(self, row, year, source_file):
        return {
            "market_name": (row.get("Market and Exchange Names") or row.get("Market_and_Exchange_Names") or "").strip(),
            "report_date": (row.get("As of Date in Form YYYY-MM-DD") or row.get("Report_Date_as_YYYY-MM-DD") or row.get("As_of_Date_In_Form_YYMMDD") or "").strip(),
            "open_interest": _integer(row, "Open Interest (All)", "Open_Interest_All"),
            "non_commercial_long": _integer(row, "Noncommercial Positions-Long (All)", "Noncommercial_Positions_Long_All"),
            "non_commercial_short": _integer(row, "Noncommercial Positions-Short (All)", "Noncommercial_Positions_Short_All"),
            "non_commercial_spreading": _integer(row, "Noncommercial Positions-Spreading (All)", "Noncommercial_Positions_Spreading_All"),
            "commercial_long": _integer(row, "Commercial Positions-Long (All)", "Commercial_Positions_Long_All"),
            "commercial_short": _integer(row, "Commercial Positions-Short (All)", "Commercial_Positions_Short_All"),
            "source_year": year,
            "source_file": source_file,
            "report_type": "FUTURES_ONLY",
        }
