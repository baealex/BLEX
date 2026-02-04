from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

_executor = ThreadPoolExecutor(max_workers=1)


class SubTaskProcessor:
    @staticmethod
    def process(func: Callable, *args: Any, **kwargs: Any) -> None:
        _executor.submit(func, *args, **kwargs)
