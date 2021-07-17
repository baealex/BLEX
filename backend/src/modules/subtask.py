import asyncio
import time
import traceback

from functools import wraps, partial
from threading import Thread

def asynchronously(func):
    @wraps(func)
    async def coro(*args, loop=None, executor=None, **kwargs):
        if loop is None:
            loop = asyncio.get_event_loop()
        partial_func = partial(func, *args, **kwargs)
        return await loop.run_in_executor(executor, partial_func)
    return coro

class AsyncLoopThread(Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.loop = asyncio.new_event_loop()

    def run(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()
        return self.loop
    
    def append(self, func):
        coro = asynchronously(func)
        self.append_async(coro())
    
    def append_async(self, coro):
        async def decorator():
            try:
                await coro
            except:
                traceback.print_exc()
        asyncio.run_coroutine_threadsafe(decorator(), self.loop)

sub_task_manager = AsyncLoopThread()
sub_task_manager.start()