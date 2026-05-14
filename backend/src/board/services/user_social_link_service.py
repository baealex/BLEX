from django.contrib.auth.models import User

from board.models import UserLinkMeta


class UserSocialLinkService:
    """Apply settings social link mutations."""

    @staticmethod
    def update_user_social_links(user: User, put) -> list[dict]:
        UserSocialLinkService.update_social_links(user, put.get('update', ''))
        UserSocialLinkService.create_social_links(user, put.get('create', ''))
        UserSocialLinkService.delete_social_links(user, put.get('delete', ''))
        return user.profile.collect_social()

    @staticmethod
    def update_social_links(user: User, update_items: str) -> None:
        for update_item in UserSocialLinkService.split_items(update_items):
            link_id, name, value, order = update_item.split(',')
            UserLinkMeta.objects.update_or_create(
                user=user,
                id=link_id,
                defaults={
                    'name': name,
                    'value': value,
                    'order': order,
                },
            )

    @staticmethod
    def create_social_links(user: User, create_items: str) -> None:
        for create_item in UserSocialLinkService.split_items(create_items):
            name, value, order = create_item.split(',')
            UserLinkMeta.objects.create(
                user=user,
                name=name,
                value=value,
                order=order,
            )

    @staticmethod
    def delete_social_links(user: User, delete_items: str) -> None:
        for delete_item in UserSocialLinkService.split_items(delete_items):
            UserLinkMeta.objects.filter(
                user=user,
                id=delete_item,
            ).delete()

    @staticmethod
    def split_items(items: str) -> list[str]:
        return [
            item
            for item in items.split('&')
            if item
        ]
