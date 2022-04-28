from graphene_django import DjangoObjectType

from board.models import (
    Comment, Config, Form, Notify, Tag,
    Post, PostContent, PostConfig, Profile
    Report, Search, Series, User)

class CommentType(DjangoObjectType):
    class Meta:
        model = Comment

class UserConfigType(DjangoObjectType):
    class Meta:
        model = Config

class FormType(DjangoObjectType):
    class Meta:
        model = Form

class NotifyType(DjangoObjectType):
    class Meta:
        model = Notify

class TagType(DjangoObjectType):
    class Meta:
        model = Tag

class PostType(DjangoObjectType):
    class Meta:
        model = Post

class PostContentType(DjangoObjectType):
    class Meta:
        model = PostContent

class PostConfigType(DjangoObjectType):
    class Meta:
        model = PostConfig

class ProfileType(DjangoObjectType):
    class Meta:
        model = Profile

class ReportType(DjangoObjectType):
    class Meta:
        model = Report

class SearchType(DjangoObjectType):
    class Meta:
        model = Search

class SeriesType(DjangoObjectType):
    class Meta:
        model = Series

class UserType(DjangoObjectType):
    class Meta:
        model = User