"""Historical COT query and range-filtering boundary."""
class CotHistoryService:
    def __init__(self, repository):
        self.repository = repository

    def get_history(self, currency_code, date_range="1Y"):
        return self.repository.get_currency_history(currency_code=currency_code, date_range=date_range)
