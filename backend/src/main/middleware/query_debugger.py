import time

from django.db import connection, reset_queries
from django.utils.deprecation import MiddlewareMixin

from modules.sysutil import flush_print


class QueryDebugger(MiddlewareMixin):
    def process_request(self, request):
        reset_queries()
        self.number_of_start_queries = len(connection.queries)
        self.start = time.perf_counter()

    def process_response(self, request, response):
        self.end = time.perf_counter()
        self.number_of_end_queries = len(connection.queries)
        flush_print(f'-------------------------------------------------------------------')
        flush_print(f'Request : {request}')
        flush_print(f'Number of Queries : {self.number_of_end_queries-self.number_of_start_queries}')
        flush_print(f'Finished in : {(self.end - self.start):.2f}s')
        flush_print(f'-------------------------------------------------------------------')
        return response
