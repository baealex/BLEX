import graphene
from graphene_django import DjangoObjectType

from board.models import Post

class PostType(DjangoObjectType):
    class Meta:
        model = Post
        fields = ('id', 'title')

class Query(graphene.ObjectType):
    all_post = graphene.List(PostType)

    def resolve_all_post(root, info):
        return Post.objects.all()

schema = graphene.Schema(query=Query)