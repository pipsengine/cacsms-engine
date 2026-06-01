"""Cross-currency institutional positioning comparison."""
def latest_by_currency(records):
    latest = {}
    for record in sorted(records, key=lambda item: item["report_date"], reverse=True):
        latest.setdefault(record["currency_code"], record)
    return list(latest.values())
