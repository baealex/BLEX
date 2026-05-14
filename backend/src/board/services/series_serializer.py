from board.modules.time import convert_to_localtime


class SeriesSerializer:
    """Serialize series API response contracts."""

    @staticmethod
    def available_post(post) -> dict:
        return {
            'id': post.id,
            'title': post.title,
            'publishedDate': (
                convert_to_localtime(post.published_date).strftime('%Y-%m-%d')
                if post.published_date else None
            ),
        }

    @staticmethod
    def public_series_list_item(series) -> dict:
        return {
            'url': series.url,
            'name': series.name,
            'image': series.thumbnail(),
            'total_posts': series.total_posts,
            'created_date': convert_to_localtime(series.created_date).strftime('%Y년 %m월 %d일'),
            'owner': series.owner_username,
        }

    @staticmethod
    def owner_series_order_item(series) -> dict:
        return {
            'url': series.url,
            'title': series.name,
            'total_posts': series.total_posts,
        }

    @staticmethod
    def public_continue_detail(series, posts) -> dict:
        return {
            'name': series.name,
            'url': series.url,
            'owner': series.owner_username,
            'owner_image': series.owner_avatar,
            'description': series.text_md,
            'total_posts': series.total_posts,
            'posts': [
                {
                    'title': post[0],
                    'url': post[1],
                }
                for post in posts
            ],
        }

    @staticmethod
    def public_detail_post(post, number: int) -> dict:
        return {
            'url': post.url,
            'number': number,
            'title': post.title,
            'image': str(post.image),
            'read_time': post.read_time,
            'description': post.meta_description,
            'created_date': convert_to_localtime(post.published_date).strftime('%Y년 %m월 %d일'),
        }

    @staticmethod
    def public_detail(series, posts, page: int, order: str) -> dict:
        start_number = series.total_posts - (
            posts.paginator.per_page * (page - 1)
        )
        return {
            'name': series.name,
            'url': series.url,
            'owner': series.owner_username,
            'owner_image': series.owner_avatar,
            'description': series.text_md,
            'total_posts': series.total_posts,
            'posts': [
                SeriesSerializer.public_detail_post(
                    post,
                    (
                        start_number - posts.index(post)
                        if order == 'latest'
                        else posts.index(post) + 1 + (page - 1) * posts.paginator.per_page
                    ),
                )
                for post in posts
            ],
            'last_page': posts.paginator.num_pages,
        }

    @staticmethod
    def owner_series_list_item(series) -> dict:
        return {
            'id': str(series.id),
            'name': series.name,
            'url': series.url,
            'total_posts': series.total_posts,
            'created_date': convert_to_localtime(series.created_date).strftime('%Y년 %m월 %d일'),
        }

    @staticmethod
    def owner_detail(series, post_ids: list[int]) -> dict:
        return {
            'id': series.id,
            'name': series.name,
            'url': series.url,
            'description': series.text_md,
            'post_ids': post_ids,
            'post_count': len(post_ids),
        }

    @staticmethod
    def mutation_detail(series, thumbnail: str = '') -> dict:
        return {
            'id': series.id,
            'name': series.name,
            'url': series.url,
            'description': series.text_md,
            'thumbnail': thumbnail,
            'postCount': series.posts.count(),
        }
