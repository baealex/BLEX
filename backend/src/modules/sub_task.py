import atexit
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor
from itertools import count
from typing import Any, Callable

_executor = ThreadPoolExecutor(max_workers=1)
_logger = logging.getLogger('board.sub_task')
_task_ids = count(1)


class SubTaskProcessor:
    @staticmethod
    def process(func: Callable, *args: Any, **kwargs: Any) -> None:
        task_id = f'background-task-{next(_task_ids)}'
        task_name, task_module, task_kind = SubTaskProcessor._get_task_metadata(func)

        try:
            _executor.submit(
                SubTaskProcessor._execute,
                func,
                args,
                kwargs,
                task_id,
                task_name,
                task_module,
                task_kind,
            )
        except Exception as error:
            SubTaskProcessor._log_failure(
                error=error,
                stage='submit',
                task_id=task_id,
                task_name=task_name,
                task_module=task_module,
                task_kind=task_kind,
            )

    @staticmethod
    def _execute(
        func: Callable,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        task_id: str,
        task_name: str,
        task_module: str,
        task_kind: str,
    ) -> None:
        try:
            func(*args, **kwargs)
        except BaseException as error:
            SubTaskProcessor._log_failure(
                error=error,
                stage='execute',
                task_id=task_id,
                task_name=task_name,
                task_module=task_module,
                task_kind=task_kind,
            )
            raise

        _logger.debug(
            'Background task completed task_id=%s task_name=%s '
            'task_module=%s task_kind=%s',
            task_id,
            task_name,
            task_module,
            task_kind,
            extra={
                'background_task_id': task_id,
                'background_task_name': task_name,
                'background_task_module': task_module,
                'background_task_kind': task_kind,
            },
        )

    @staticmethod
    def _get_task_metadata(func: Callable) -> tuple[str, str, str]:
        task_kind = func.__class__.__name__
        task_name = getattr(func, '__qualname__', None)
        task_module = getattr(func, '__module__', None)

        if not isinstance(task_name, str) or not task_name:
            task_name = task_kind
        if not isinstance(task_module, str) or not task_module:
            task_module = func.__class__.__module__

        return task_name, task_module, task_kind

    @staticmethod
    def _log_failure(
        error: BaseException,
        stage: str,
        task_id: str,
        task_name: str,
        task_module: str,
        task_kind: str,
    ) -> None:
        exception_type = type(error).__name__
        safe_stack = ' <- '.join(
            f'{frame.filename}:{frame.lineno} in {frame.name}'
            for frame in traceback.extract_tb(error.__traceback__)
        )
        log_extra = {
            'background_task_id': task_id,
            'background_task_name': task_name,
            'background_task_module': task_module,
            'background_task_kind': task_kind,
            'background_task_stage': stage,
            'background_task_exception_type': exception_type,
        }
        log_message = (
            'Background task failed task_id=%s task_name=%s '
            'task_module=%s task_kind=%s stage=%s exception_type=%s'
        )
        log_args = (
            task_id,
            task_name,
            task_module,
            task_kind,
            stage,
            exception_type,
        )

        if safe_stack:
            _logger.error(
                f'{log_message} stack=%s',
                *log_args,
                safe_stack,
                extra=log_extra,
            )
            return

        _logger.error(log_message, *log_args, extra=log_extra)

    @staticmethod
    def _shutdown() -> None:
        _executor.shutdown(wait=True, cancel_futures=False)


atexit.register(SubTaskProcessor._shutdown)
