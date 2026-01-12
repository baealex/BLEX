"""
Django management command to analyze comments with backtick mentions.
"""
import re
from django.core.management.base import BaseCommand
from board.models import Comment


class Command(BaseCommand):
    help = 'Analyze comments with backtick mentions for migration to reply system'

    def handle(self, *args, **options):
        # Pattern to find backtick mentions
        pattern = r'`@([a-zA-Z0-9\.]+)`'

        # Find all comments without parents (top-level) that contain backtick mentions
        all_comments = Comment.objects.filter(
            text_md__contains='`@',
            parent__isnull=True
        ).select_related('author', 'post').order_by('created_date')

        self.stdout.write(f'\nTotal top-level comments with `@` pattern: {all_comments.count()}\n')

        migration_candidates = []

        for comment in all_comments:
            mentions = re.findall(pattern, comment.text_md)
            if mentions:
                # For each mention, try to find the referenced comment
                for mentioned_username in mentions:
                    # Find potential parent comments by this user on the same post
                    # that were created before this comment
                    potential_parents = Comment.objects.filter(
                        post=comment.post,
                        author__username=mentioned_username,
                        created_date__lt=comment.created_date,
                        parent__isnull=True
                    ).order_by('-created_date')

                    if potential_parents.exists():
                        parent = potential_parents.first()
                        migration_candidates.append({
                            'comment_id': comment.id,
                            'comment_author': comment.author_username(),
                            'comment_text': comment.text_md,
                            'mentioned_user': mentioned_username,
                            'potential_parent_id': parent.id,
                            'potential_parent_text': parent.text_md,
                            'post_url': comment.post.url if comment.post else 'N/A'
                        })

        self.stdout.write(self.style.SUCCESS(
            f'\nMigration candidates found: {len(migration_candidates)}\n'
        ))
        self.stdout.write('=' * 100)

        for i, candidate in enumerate(migration_candidates[:10], 1):
            self.stdout.write(f'\n{i}. Comment ID: {candidate["comment_id"]} by {candidate["comment_author"]}')
            self.stdout.write(f'   Post: {candidate["post_url"]}')
            self.stdout.write(f'   Mentions: @{candidate["mentioned_user"]}')
            self.stdout.write(f'   Text: {candidate["comment_text"][:80]}...')
            self.stdout.write(self.style.WARNING(
                f'   → Will become reply to Comment ID: {candidate["potential_parent_id"]}'
            ))
            self.stdout.write(f'   → Parent text: {candidate["potential_parent_text"][:80]}...')

        if len(migration_candidates) > 10:
            self.stdout.write(f'\n... and {len(migration_candidates) - 10} more candidates')

        self.stdout.write('\n')
