from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from uuid import uuid4

from bs4 import BeautifulSoup
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.http import Http404
from django.test import Client, RequestFactory, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from PIL import Image

from board.models import Profile, SiteSetting, WorkLog, WorkLogEntry, WorkLogShare
from board.services.user_role_service import UserRoleService
from board.services.work_log_service import WorkLogService
from main.resource_views import serve_public_resource


class WorkLogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('writer')
        cls.other = User.objects.create_user('other')
        cls.reader = User.objects.create_user('reader')
        for user in (cls.owner, cls.other):
            Profile.objects.create(user=user, role=Profile.Role.EDITOR)
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)
        cls.log = WorkLog.objects.create(owner=cls.owner, title='Draft recovery')

    def setUp(self):
        self.client.force_login(self.owner)
        self.entry_url = reverse('work_log_add_entry', args=[self.log.pk])
        self.share_url = reverse('work_log_publish_share', args=[self.log.pk])

    def add_image(self, title):
        image = BytesIO()
        Image.new('RGB', (16, 16), 'teal').save(image, format='PNG')
        upload = SimpleUploadedFile('screen.png', image.getvalue(), content_type='image/png')
        self.assertEqual(self.client.post(self.entry_url, {'title': title, 'attachment': upload}).status_code, 302)
        return self.log.entries.get(title=title)

    def publish(self, entries):
        response = self.client.post(self.share_url, {
            'headline': 'The draft stays',
            'entries': [entry.pk for entry in entries],
            'action': 'publish',
        })
        self.assertEqual(response.status_code, 302)
        return WorkLogShare.objects.get(log=self.log)

    def test_create_log_and_capture_short_note(self):
        response = self.client.post(reverse('work_logs'), {'title': 'Editor fixes'})
        log = WorkLog.objects.get(title='Editor fixes')
        self.assertRedirects(response, reverse('work_log_detail', args=[log.pk]))
        self.assertEqual(log.owner, self.owner)
        self.client.post(self.entry_url, {'text': 'A short note is enough.'})
        self.assertEqual(self.log.entries.get().text, 'A short note is enough.')

    def test_work_log_controls_and_share_page_follow_the_requested_language(self):
        entry = self.log.entries.create(title='사용자가 쓴 원문')
        share = self.publish([entry])
        detail = reverse('work_log_detail', args=[self.log.pk])
        shared = reverse('work_log_shared', args=[share.token])
        for language, choose, stop, timeline in (
            ('en', 'Choose file', 'Stop sharing', 'How it came together'),
            ('ko', '파일 선택', '공유 중지', '이렇게 만들었어요'),
        ):
            with self.subTest(language=language):
                response = self.client.get(detail, HTTP_ACCEPT_LANGUAGE=language)
                self.assertEqual(response['Content-Language'], language)
                self.assertContains(response, choose)
                self.assertContains(response, stop)
                response = Client().get(shared, HTTP_ACCEPT_LANGUAGE=language)
                self.assertEqual(response['Content-Language'], language)
                self.assertContains(response, timeline)
                self.assertContains(response, entry.title)

    def test_preview_publish_and_revoke_a_fixed_selection(self):
        self.client.post(self.entry_url, {'title': 'Reproduced', 'text': '<script>unsafe</script>'})
        first = self.log.entries.get(title='Reproduced')
        visible = self.add_image('Recovery verified')
        hidden = self.add_image('Internal screenshot')
        response = self.client.post(self.share_url, {
            'headline': 'The draft stays',
            'entries': [visible.pk, first.pk],
        })
        self.assertContains(response, 'The draft stays')
        self.assertNotContains(response, 'Internal screenshot')
        self.assertIsNone(BeautifulSoup(response.content, 'html.parser').find('meta', property='og:title'))
        self.assertFalse(self.log.shares.exists())

        share = self.publish([visible, first])
        shared_url = reverse('work_log_shared', args=[share.token])
        public_media = reverse('work_log_shared_media', args=[share.token, visible.pk])
        hidden_media = reverse('work_log_shared_media', args=[share.token, hidden.pk])
        self.client.post(self.entry_url, {'text': 'A later note'})
        visitor = Client()
        response = visitor.get(shared_url)
        self.assertContains(response, 'The draft stays')
        soup = BeautifulSoup(response.content, 'html.parser')
        self.assertIsNotNone(soup.find('meta', property='og:image'))
        timeline = soup.select_one('[aria-labelledby="timeline-heading"]')
        self.assertEqual([heading.get_text() for heading in timeline.find_all('h3')], [
            'Reproduced', 'Recovery verified',
        ])
        self.assertIn('<script>unsafe</script>', timeline.get_text())
        self.assertIsNone(timeline.find('script'))
        self.assertNotContains(response, 'Internal screenshot')
        self.assertNotContains(response, 'A later note')
        self.assertIn('noindex', response['X-Robots-Tag'])
        self.assertIn('no-store', response['Cache-Control'])
        with visible.attachment.open('rb') as media:
            expected_image = media.read()
        self.assertEqual(b''.join(visitor.get(public_media).streaming_content), expected_image)
        self.assertEqual(visitor.get(hidden_media).status_code, 404)

        revoke_url = reverse('work_log_revoke_share', args=[self.log.pk, share.token])
        self.assertEqual(self.client.get(revoke_url).status_code, 405)
        self.assertEqual(self.client.post(revoke_url).status_code, 302)
        self.assertEqual(visitor.get(shared_url).status_code, 404)
        self.assertEqual(visitor.get(public_media).status_code, 404)

    def test_private_access_and_cross_log_selection(self):
        image = self.add_image('Private')
        detail_url = reverse('work_log_detail', args=[self.log.pk])
        private_media = reverse('work_log_private_media', args=[self.log.pk, image.pk])
        self.assertEqual(Client().get(detail_url).status_code, 302)
        self.assertEqual(Client().get(private_media).status_code, 302)
        self.assertEqual(Client().get(reverse('work_log_shared', args=[uuid4()])).status_code, 404)

        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(reverse('work_logs')).status_code, 200)
        self.assertEqual(self.client.post(reverse('work_logs'), {'title': 'No authoring'}).status_code, 403)

        self.client.force_login(self.other)
        self.assertEqual(self.client.get(detail_url).status_code, 404)
        self.assertEqual(self.client.get(private_media).status_code, 404)
        self.assertEqual(self.client.post(self.entry_url, {'text': 'Intrusion'}).status_code, 404)
        other_log = WorkLog.objects.create(owner=self.other, title='Other work')
        other_share_url = reverse('work_log_publish_share', args=[other_log.pk])
        response = self.client.post(other_share_url, {
            'headline': 'Wrong log', 'entries': [image.pk], 'action': 'publish',
        })
        self.assertTrue(response.context['share_form'].errors)
        self.assertFalse(WorkLogShare.objects.exists())

    def test_owner_can_revoke_after_losing_editor_role(self):
        entry = self.add_image('Private attachment')
        share = self.publish([entry])
        revoke_url = reverse('work_log_revoke_share', args=[self.log.pk, share.token])
        shared_url = reverse('work_log_shared', args=[share.token])
        private_media_url = reverse('work_log_private_media', args=[self.log.pk, entry.pk])
        UserRoleService.set_profile_role(self.owner.profile, Profile.Role.READER)

        self.assertContains(self.client.get(reverse('work_logs')), self.log.title)
        response = self.client.get(reverse('work_log_detail', args=[self.log.pk]))
        self.assertContains(response, revoke_url)
        self.assertIsNone(BeautifulSoup(response.content, 'html.parser').find('form', action=self.entry_url))
        self.assertEqual(self.client.get(private_media_url).status_code, 200)
        self.assertEqual(self.client.post(self.entry_url, {'text': 'No authoring'}).status_code, 403)
        self.assertEqual(self.client.post(self.share_url, {
            'headline': 'No new link', 'entries': [entry.pk], 'action': 'publish',
        }).status_code, 403)
        self.assertEqual(self.client.post(revoke_url).status_code, 302)
        self.assertEqual(Client().get(shared_url).status_code, 404)

    @override_settings(DEBUG=False)
    def test_work_log_pages_exclude_site_scripts(self):
        setting = SiteSetting.get_instance()
        setting.header_script = '<script data-site-head-marker></script>'
        setting.footer_script = '<script data-site-footer-marker></script>'
        setting.save()
        entry = self.log.entries.create(title='Shared entry')
        share = self.publish([entry])

        public_profile = self.client.get(reverse('user_profile', args=[self.owner.username]))
        self.assertContains(public_profile, 'data-site-head-marker')
        self.assertContains(public_profile, 'data-site-footer-marker')
        for client, url, status_code in (
            (self.client, reverse('work_logs'), 200),
            (self.client, reverse('work_log_detail', args=[self.log.pk]), 200),
            (self.client, reverse('work_log_delete_entry', args=[self.log.pk, entry.pk]), 200),
            (Client(), reverse('work_log_shared', args=[share.token]), 200),
            (Client(), reverse('work_log_shared', args=[uuid4()]), 404),
        ):
            response = client.get(url)
            self.assertNotContains(response, 'data-site-head-marker', status_code=status_code)
            self.assertNotContains(response, 'data-site-footer-marker', status_code=status_code)
            meta = BeautifulSoup(response.content, 'html.parser').find('meta', attrs={'name': 'referrer'})
            self.assertEqual(meta['content'], 'strict-origin')
            if response.status_code == 200:
                self.assertEqual(response['Referrer-Policy'], 'strict-origin')

    def test_rejects_excess_request_size_before_multipart_parsing(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.owner)
        response = client.generic(
            'POST',
            self.entry_url,
            content_type='multipart/form-data; boundary=not-read',
            CONTENT_LENGTH=str(13 * 1024 * 1024 + 1),
        )
        self.assertEqual(response.status_code, 413)
        self.assertFalse(self.log.entries.exists())

    def test_validates_attachment_and_serves_video_range(self):
        fake = SimpleUploadedFile('fake.png', b'<html>', content_type='image/png')
        response = self.client.post(self.entry_url, {'attachment': fake})
        self.assertTrue(response.context['entry_form'].errors)
        self.assertFalse(self.log.entries.exists())

        video = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00'
        response = self.client.post(self.entry_url, {
            'attachment': SimpleUploadedFile('demo.mp4', video, content_type='video/mp4'),
        })
        self.assertEqual(response.status_code, 302)
        entry = self.log.entries.get()
        share = self.publish([entry])
        url = reverse('work_log_shared_media', args=[share.token, entry.pk])
        response = Client().get(url, HTTP_RANGE='bytes=1-4')
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response['Content-Range'], f'bytes 1-4/{len(video)}')
        self.assertEqual(response['Content-Type'], 'video/mp4')
        self.assertEqual(b''.join(response.streaming_content), video[1:5])
        self.assertEqual(response['Content-Length'], '4')
        self.assertEqual(Client().head(url)['Content-Length'], str(len(video)))
        self.assertEqual(Client().get(url, HTTP_RANGE='bytes=100-').status_code, 416)
        with entry.attachment.open('rb') as stored_file:
            self.assertEqual(stored_file.read(), video)

    def test_paged_selection_can_preview_publish_and_read_earlier_entries(self):
        for n in range(1, 6):
            self.log.entries.create(title=f'Note {n}')
        third, fourth, fifth = [self.log.entries.get(title=f'Note {n}').pk for n in (3, 4, 5)]
        path = reverse('work_log_detail', args=[self.log.pk])
        with patch.object(WorkLogService, 'page_size', 2):
            response = self.client.get(path)
            self.assertContains(response, 'Note 5')
            self.assertNotContains(response, 'Note 3')

            response = self.client.post(self.share_url, {
                'selection_page': '2', 'entries': [fourth, fifth],
            })
            self.assertEqual(response.context['selector'].number, 2)
            self.assertEqual(response.context['saved_selection'], f'{fourth},{fifth}')
            self.assertEqual(response.context['timeline'].number, 1)

            response = self.client.post(self.share_url, {
                'headline': 'A paged share', 'selected_entries': f'{fourth},{fifth}', 'entries': [third],
            })
            selected = response.context['selected_entries']
            self.assertEqual(selected, f'{third},{fourth},{fifth}')
            self.assertContains(response, 'Note 3')
            self.assertNotContains(response, 'Note 5')

            response = self.client.post(self.share_url, {
                'headline': 'A paged share', 'selected_entries': selected, 'preview_page': '2',
            })
            self.assertContains(response, 'Note 5')
            response = self.client.post(self.share_url, {
                'headline': 'A paged share', 'selected_entries': selected, 'action': 'publish',
            })
            self.assertEqual(response.status_code, 302)
            share = self.log.shares.get()
            shared_url = reverse('work_log_shared', args=[share.token])
            self.assertNotContains(Client().get(shared_url), 'Note 5')
            self.assertContains(Client().get(shared_url, {'page': 2}), 'Note 5')

    def test_private_files_block_static_serving_and_are_removed_after_delete(self):
        entry = self.add_image('Private file')
        storage = entry.attachment.storage
        filename = entry.attachment.name
        self.assertTrue(storage.exists(filename))
        self.assertEqual(Path(entry.attachment.path).stat().st_mode & 0o777, 0o600)

        with TemporaryDirectory() as root:
            root = Path(root)
            private_path = f'media/_work_logs/{filename}'
            file = root / private_path
            file.parent.mkdir(parents=True)
            file.write_bytes(b'private')
            public_file = root / 'media' / 'public.png'
            public_file.write_bytes(b'public')
            request = RequestFactory().get('/')
            with override_settings(MEDIA_ROOT=root / 'media'):
                with self.assertRaises(Http404):
                    serve_public_resource(request, private_path, str(root))
                with self.assertRaises(Http404):
                    serve_public_resource(request, f'media/subdir/../_work_logs/{filename}', str(root))
                public = serve_public_resource(request, 'media/public.png', str(root))
                self.assertEqual(b''.join(public.streaming_content), b'public')

        with self.captureOnCommitCallbacks(execute=True):
            self.log.delete()
            self.assertTrue(storage.exists(filename))
        self.assertFalse(storage.exists(filename))

    def test_deleting_entry_and_log_updates_shares_and_removes_attachments(self):
        deleted = self.add_image('Delete this entry')
        kept = self.add_image('Keep this entry')
        single = self.publish([deleted])
        mixed = WorkLogService.create_share(self.log, 'Mixed entries', {deleted.pk, kept.pk})
        delete_entry = reverse('work_log_delete_entry', args=[self.log.pk, deleted.pk])
        delete_log = reverse('work_log_delete', args=[self.log.pk])
        single_url = reverse('work_log_shared', args=[single.token])
        mixed_url = reverse('work_log_shared', args=[mixed.token])
        removed_media = reverse('work_log_shared_media', args=[mixed.token, deleted.pk])
        visitor = Client()

        outsider = Client()
        outsider.force_login(self.other)
        self.assertEqual(outsider.post(delete_entry).status_code, 404)
        self.assertEqual(outsider.post(delete_log).status_code, 404)
        self.assertContains(self.client.get(delete_entry), deleted.title)
        self.assertTrue(self.log.entries.filter(pk=deleted.pk).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(delete_entry).status_code, 302)
        self.assertEqual(visitor.get(single_url).status_code, 404)
        self.assertEqual(visitor.get(removed_media).status_code, 404)
        self.assertContains(visitor.get(mixed_url), kept.title)
        self.assertNotContains(visitor.get(mixed_url), deleted.title)
        self.assertFalse(deleted.attachment.storage.exists(deleted.attachment.name))

        self.assertContains(self.client.get(delete_log), self.log.title)
        self.assertTrue(WorkLog.objects.filter(pk=self.log.pk).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertRedirects(self.client.post(delete_log), reverse('work_logs'))
        self.assertEqual(visitor.get(mixed_url).status_code, 404)
        self.assertFalse(kept.attachment.storage.exists(kept.attachment.name))

    def test_log_index_counts_entries_only_for_the_requested_page(self):
        self.log.entries.create(title='Older log entry')
        newer = WorkLog.objects.create(owner=self.owner, title='Newer log')
        WorkLogEntry.objects.bulk_create([WorkLogEntry(log=newer, title='A') for _ in range(2)])
        with patch.object(WorkLogService, 'page_size', 1):
            with CaptureQueriesContext(connection) as queries:
                response = self.client.get(reverse('work_logs'))
            work_log_queries = [query['sql'] for query in queries.captured_queries if 'board_worklog' in query['sql']]
            self.assertEqual(response.context['logs'][0].entry_count, 2)
            self.assertEqual(self.client.get(reverse('work_logs'), {'page': 2}).context['logs'][0].entry_count, 1)

        self.assertEqual(len(work_log_queries), 3)
        entry_queries = [query for query in work_log_queries if 'board_worklogentry' in query]
        self.assertEqual(len(entry_queries), 1)
        self.assertIn(f'"board_worklogentry"."log_id" IN ({newer.pk})', entry_queries[0])
