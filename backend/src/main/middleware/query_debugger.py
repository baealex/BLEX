import functools
import time

from django.db import connection, reset_queries
from django.utils.deprecation import MiddlewareMixin

class QueryDebugger(MiddlewareMixin):
    def process_request(self, request):
        reset_queries()
        self.number_of_start_queries = len(connection.queries)
        self.start = time.perf_counter()

    def process_response(self, request, response):
        self.end = time.perf_counter()
        self.number_of_end_queries = len(connection.queries)
        print(f"-------------------------------------------------------------------")
        print(f"Request : {request}")
        print(f"Number of Queries : {self.number_of_end_queries-self.number_of_start_queries}")
        print(f"Finished in : {(self.end - self.start):.2f}s")
        print(f"-------------------------------------------------------------------")
        return response
