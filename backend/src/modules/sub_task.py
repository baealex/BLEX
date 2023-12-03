import asyncio

from functools import wraps, partial


def asynchronously(func):
    @wraps(func)
    async def coro(*args, loop=None, executor=None, **kwargs):
        if loop is None:
            loop = asyncio.get_event_loop()
        partial_func = partial(func, *args, **kwargs)
        return await loop.run_in_executor(executor, partial_func)
    return coro


class SubTaskProcessor:
    @staticmethod
    def process(func, *args, **kwargs):
        asyncio.run(asynchronously(func)(*args, **kwargs))
