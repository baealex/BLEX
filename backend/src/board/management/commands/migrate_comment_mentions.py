"""
Django management command to migrate comments with backtick mentions to reply system.

This command converts old-style mention comments (`@username`) into the new nested reply system.
It finds comments that mention other users with backticks and converts them into replies
to those users' comments.

Usage:
    python manage.py migrate_comment_mentions          # Dry run (preview only)
    python manage.py migrate_comment_mentions --apply  # Apply changes
"""
import re
from django.core.management.base import BaseCommand
from django.db import transaction
from board.models import Comment


class Command(BaseCommand):
    help = 'Migrate comments with backtick mentions to reply system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Actually apply the migration (default is dry-run)',
        )

    def handle(self, *args, **options):
        apply_changes = options['apply']

        if apply_changes:
            self.stdout.write(self.style.WARNING(
                '\n⚠️  APPLYING MIGRATION - Changes will be saved to database\n'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                '\n🔍 DRY RUN MODE - No changes will be saved\n'
                'Use --apply flag to actually migrate the data\n'
            ))

        # Pattern to find backtick mentions
        pattern = r'`@([a-zA-Z0-9\.]+)`'

        # Find all comments without parents (top-level) that contain backtick mentions
        all_comments = Comment.objects.filter(
            text_md__contains='`@',
            parent__isnull=True
        ).select_related('author', 'post').order_by('created_date')

        self.stdout.write(f'\nScanning {all_comments.count()} comments with potential mentions...\n')

        migration_count = 0
        skipped_count = 0
        error_count = 0

        for comment in all_comments:
            mentions = re.findall(pattern, comment.text_md)

            if not mentions:
                continue

            # Take only the first mention for migration
            # (assuming the first mention is the primary reply target)
            mentioned_username = mentions[0]

            # Find potential parent comment by this user on the same post
            # that was created before this comment
            potential_parents = Comment.objects.filter(
                post=comment.post,
                author__username=mentioned_username,
                created_date__lt=comment.created_date,
                parent__isnull=True
            ).order_by('-created_date')

            if not potential_parents.exists():
                skipped_count += 1
                self.stdout.write(
                    f'⏭️  Skipped Comment {comment.id}: No parent found for @{mentioned_username}'
                )
                continue

            parent = potential_parents.first()

            # Remove the backtick mention from text
            new_text_md = re.sub(
                r'`@' + re.escape(mentioned_username) + r'`\s*',
                '',
                comment.text_md,
                count=1  # Remove only first mention
            ).strip()

            # If removing mention leaves empty text, skip
            if not new_text_md:
                skipped_count += 1
                self.stdout.write(
                    f'⏭️  Skipped Comment {comment.id}: Would result in empty text'
                )
                continue

            self.stdout.write('\n' + '=' * 100)
            self.stdout.write(self.style.SUCCESS(f'\n✅ Migrating Comment {comment.id}'))
            self.stdout.write(f'   Author: {comment.author_username()}')
            self.stdout.write(f'   Post: {comment.post.url if comment.post else "N/A"}')
            self.stdout.write(f'   Created: {comment.created_date}')
            self.stdout.write(f'\n   OLD TEXT:\n   {comment.text_md[:200]}{"..." if len(comment.text_md) > 200 else ""}')
            self.stdout.write(f'\n   NEW TEXT:\n   {new_text_md[:200]}{"..." if len(new_text_md) > 200 else ""}')
            self.stdout.write(self.style.WARNING(
                f'\n   → Setting parent to Comment {parent.id} by @{mentioned_username}'
            ))
            self.stdout.write(f'   → Parent text: {parent.text_md[:100]}{"..." if len(parent.text_md) > 100 else ""}')

            if apply_changes:
                try:
                    with transaction.atomic():
                        # Update the comment
                        comment.parent = parent
                        comment.text_md = new_text_md

                        # Regenerate HTML from markdown
                        from modules.markdown import parse_to_html
                        comment.text_html = parse_to_html(new_text_md)

                        comment.save()
                        migration_count += 1
                        self.stdout.write(self.style.SUCCESS('   ✓ Applied'))

                except Exception as e:
                    error_count += 1
                    self.stdout.write(self.style.ERROR(f'   ✗ Error: {str(e)}'))
            else:
                migration_count += 1

        self.stdout.write('\n' + '=' * 100)
        self.stdout.write(self.style.SUCCESS(f'\n📊 SUMMARY:'))
        self.stdout.write(f'   Total comments scanned: {all_comments.count()}')
        self.stdout.write(f'   Migrations {"applied" if apply_changes else "planned"}: {migration_count}')
        self.stdout.write(f'   Skipped: {skipped_count}')

        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'   Errors: {error_count}'))

        if not apply_changes and migration_count > 0:
            self.stdout.write(self.style.WARNING(
                f'\n💡 To apply these {migration_count} migrations, run:'
            ))
            self.stdout.write(self.style.WARNING(
                '   python manage.py migrate_comment_mentions --apply'
            ))
        elif apply_changes and migration_count > 0:
            self.stdout.write(self.style.SUCCESS(
                f'\n🎉 Successfully migrated {migration_count} comments!'
            ))

        self.stdout.write('\n')
