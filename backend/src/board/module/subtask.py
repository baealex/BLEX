import time
import threading
import traceback

from collections import deque

class SubTaskManager:
    def __init__(self):
        self.is_running = False
        self.task_queue = deque([])

    def _do_task(self):
        self.is_running = True
        while len(self.task_queue) > 0:
            task = self.task_queue.popleft()
            try:
                task()
            except Exception:
                traceback.print_exc()
        self.is_running = False
    
    def append_task(self, fn):
        if not 'function' in str(type(fn)):
            return
        self.task_queue.append(fn)

        if not self.is_running:
            t = threading.Thread(target=self._do_task)
            t.setDaemon(True)
            t.start()

sub_task_manager = SubTaskManager()