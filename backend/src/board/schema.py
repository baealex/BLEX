import graphene
from graphene_django import DjangoObjectType

from board.models import Post, User, Series

class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')

class SeriesType(DjangoObjectType):
    class Meta:
        model = Series
        fields = ('id', 'name', 'url', 'created_date', 'updated_date')

class PostType(DjangoObjectType):
    class Meta:
        model = Post
        fields = ('id', 'title', 'url', 'author', 'series', 'read_time', 'tags', 'created_date', 'updated_date')

class Query(graphene.ObjectType):
    posts = graphene.Field(PostType, id=graphene.String(required=True))

    def resolve_posts(root, info, id):
        return Post.objects.get(id=id)
    
    all_posts = graphene.List(PostType)

    def resolve_all_posts(root, info):
        return Post.objects.select_related('author').all()

schema = graphene.Schema(query=Query)