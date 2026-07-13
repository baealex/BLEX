import inspect
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase

import modules.sub_task as sub_task_module
from board.services.webhook_service import WebhookService
from modules.sub_task import SubTaskProcessor


class SensitiveTask:
    def __init__(self, secret: str):
        self.secret = secret

    def __repr__(self):
        return self.secret

    def __call__(self):
        raise RuntimeError('literal-exception-secret ' + self.secret)


class SubTaskProcessorTestCase(SimpleTestCase):
    def create_executor(self) -> ThreadPoolExecutor:
        executor = ThreadPoolExecutor(max_workers=1)
        self.addCleanup(
            executor.shutdown,
            wait=True,
            cancel_futures=False,
        )
        return executor

    def test_process_signature_and_non_blocking_return_are_stable(self):
        signature = inspect.signature(SubTaskProcessor.process)
        parameters = tuple(signature.parameters.values())
        self.assertEqual(
            tuple((parameter.name, parameter.kind) for parameter in parameters),
            (
                ('func', inspect.Parameter.POSITIONAL_OR_KEYWORD),
                ('args', inspect.Parameter.VAR_POSITIONAL),
                ('kwargs', inspect.Parameter.VAR_KEYWORD),
            ),
        )
        self.assertIs(signature.return_annotation, None)

        executor = self.create_executor()
        started = threading.Event()
        release = threading.Event()
        finished = threading.Event()
        self.addCleanup(release.set)

        def blocking_task():
            started.set()
            release.wait(timeout=2)
            finished.set()

        with patch.object(sub_task_module, '_executor', executor):
            start = time.perf_counter()
            result = SubTaskProcessor.process(blocking_task)
            elapsed = time.perf_counter() - start

            self.assertIsNone(result)
            self.assertLess(elapsed, 0.5)
            self.assertTrue(started.wait(timeout=1))
            self.assertFalse(finished.is_set())

            release.set()
            self.assertTrue(finished.wait(timeout=1))

    def test_execution_failure_is_redacted_and_does_not_block_next_task(self):
        executor = self.create_executor()
        next_task_completed = threading.Event()
        bot_token = 'bot-token-secret'
        webhook_url = 'https://discord.example/webhook/private-secret'
        telegram_id = '987654321'
        literal_secret = 'literal-exception-secret'
        secret = f'{bot_token} {webhook_url} {telegram_id}'

        with patch.object(sub_task_module, '_executor', executor):
            with self.assertLogs('board.sub_task', level='ERROR') as captured:
                SubTaskProcessor.process(SensitiveTask(secret))
                SubTaskProcessor.process(next_task_completed.set)
                self.assertTrue(next_task_completed.wait(timeout=2))

        output = '\n'.join(captured.output)
        self.assertIn('Background task failed', output)
        self.assertIn('task_name=SensitiveTask', output)
        self.assertIn('stage=execute', output)
        self.assertIn('exception_type=RuntimeError', output)
        self.assertNotIn(bot_token, output)
        self.assertNotIn(webhook_url, output)
        self.assertNotIn(telegram_id, output)
        self.assertNotIn(literal_secret, output)

        failure_record = captured.records[0]
        self.assertTrue(failure_record.background_task_id.startswith('background-task-'))
        self.assertEqual(failure_record.background_task_name, 'SensitiveTask')
        self.assertEqual(failure_record.background_task_module, __name__)
        self.assertEqual(failure_record.background_task_kind, 'SensitiveTask')
        self.assertEqual(failure_record.background_task_stage, 'execute')
        self.assertEqual(failure_record.background_task_exception_type, 'RuntimeError')

    def test_submit_failure_is_redacted_and_not_raised_to_caller(self):
        executor = Mock()
        bot_token = 'submit-bot-token-secret'
        webhook_url = 'https://discord.example/webhook/submit-secret'
        telegram_id = '123456789'
        executor.submit.side_effect = RuntimeError(
            f'{bot_token} {webhook_url} {telegram_id}'
        )

        with patch.object(sub_task_module, '_executor', executor):
            with self.assertLogs('board.sub_task', level='ERROR') as captured:
                result = SubTaskProcessor.process(
                    lambda value: value,
                    bot_token,
                    webhook_url=webhook_url,
                    telegram_id=telegram_id,
                )

        self.assertIsNone(result)
        output = '\n'.join(captured.output)
        self.assertIn('stage=submit', output)
        self.assertIn('exception_type=RuntimeError', output)
        self.assertNotIn(bot_token, output)
        self.assertNotIn(webhook_url, output)
        self.assertNotIn(telegram_id, output)

        failure_record = captured.records[0]
        self.assertEqual(failure_record.background_task_stage, 'submit')
        self.assertEqual(failure_record.background_task_exception_type, 'RuntimeError')

    def test_shutdown_waits_for_queued_tasks_without_cancelling_them(self):
        executor = self.create_executor()
        completed_tasks = []

        with patch.object(sub_task_module, '_executor', executor):
            SubTaskProcessor.process(lambda: completed_tasks.append('first'))
            SubTaskProcessor.process(lambda: completed_tasks.append('second'))
            SubTaskProcessor._shutdown()

        self.assertEqual(completed_tasks, ['first', 'second'])

    @patch('board.services.webhook_service.requests.post')
    def test_webhook_request_failure_does_not_log_webhook_url(self, mock_post):
        webhook_url = 'https://discord.example/webhook/private-secret'
        error_secret = 'request-error-secret'
        mock_post.side_effect = requests.RequestException(
            f'{webhook_url} {error_secret}'
        )

        with self.assertLogs(
            'board.services.webhook_service',
            level='WARNING',
        ) as captured:
            result = WebhookService.send_webhook(
                webhook_url,
                'content',
                'https://blex.example/@author/post',
            )

        self.assertFalse(result)
        output = '\n'.join(captured.output)
        self.assertIn('exception_type=RequestException', output)
        self.assertNotIn(webhook_url, output)
        self.assertNotIn(error_secret, output)
        self.assertEqual(
            captured.records[0].webhook_exception_type,
            'RequestException',
        )
