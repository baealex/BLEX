from board.models import Notify

def create_notify(user, url: str, content: str, hidden_key: str = None):
    key = Notify.create_hash_key(user=user, url=url, content=content, hidden_key=hidden_key)

    if Notify.objects.filter(key=key).exists():
        return

    new_notify = Notify.objects.create(
        user=user,
        key=key,
        url=url,
        content=content,
    )
    new_notify.send_notify()
