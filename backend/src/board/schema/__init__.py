import graphene

from board.models import Post

from .types import PostType

class Query(graphene.ObjectType):
    posts = graphene.Field(PostType, id=graphene.String(required=True))

    def resolve_posts(root, info, id):
        return Post.objects.get(id=id)
    
    all_posts = graphene.List(PostType)

    def resolve_all_posts(root, info):
        return Post.objects.select_related('author').all()

schema = graphene.Schema(query=Query)