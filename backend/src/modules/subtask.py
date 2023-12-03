import threading
import queue
import time

class SubTaskManager:
    def __init__(self):
        self.task_queue = queue.Queue()
        self.thread = threading.Thread(target=self._process_thread)
        self.thread.daemon = True
        self.thread.start()

    def append(self, func, *args, **kwargs):
        self.task_queue.put((func, args, kwargs))

    def _process_thread(self):
        while True:
            time.sleep(0.1)
            task = self.task_queue.get()
            if task is None:
                break
            func, args, kwargs = task
            try:
                func(*args, **kwargs)
            except Exception as e:
                print(f"Error in background task: {e}")

    def stop(self):
        self.task_queue.put(None)
        self.thread.join()

sub_task_manager = SubTaskManager()
