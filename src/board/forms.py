from django import forms
from django.contrib.auth.forms import UserChangeForm
from .models import *

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ('image', 'title', 'text_md', 'tag', 'notice', 'hide', 'block_comment') # 'category'

        widgets={
            'title':forms.TextInput(attrs={'placeholder':'제목을 입력하세요. 제목은 URL 주소가 됩니다.','class':'blex-title-input'}),
            'text_md':forms.Textarea(attrs={'placeholder':'부적절한 컨텐츠는 삭제될 수 있습니다.','class':'blex-content-input'}),
            'tag':forms.TextInput(attrs={'class':'form-control'}),
            'notice':forms.CheckboxInput(attrs={'class':'custom-control-input'}),
            'hide':forms.CheckboxInput(attrs={'class':'custom-control-input'}),
            'block_comment':forms.CheckboxInput(attrs={'class':'custom-control-input'}),
            'image':forms.FileInput(attrs={'style':'display: none;','class':'form-control', 'required': False})
        }
        labels={
            'category':'카테고리',
            'title':'',
            'text_md':'',
            'image':'표지 이미지',
            'tag':'태그',
        }

class CustomUserChangeForm(UserChangeForm):
    new_password = forms.CharField(max_length=200, widget=forms.PasswordInput(attrs={'placeholder':'새 비밀번호','class':'form-control'}), label='', required=False)
    password_check = forms.CharField(max_length=200, widget=forms.PasswordInput(attrs={'placeholder':'비밀번호 확인','class':'form-control'}), label='', required=False)
    field_order=['first_name','password']

    class Meta:
        model = User
        fields = ['first_name','password']
        widgets={
            'first_name': forms.TextInput(attrs={'placeholder':'이름','class':'form-control'}),
            'email': forms.TextInput(attrs={'placeholder':'이메일 주소','class':'form-control'}),
        }
        labels={
            'first_name': '',
            'email': '',
        }

class UserForm(forms.ModelForm):
    password_check = forms.CharField(max_length=200, widget=forms.PasswordInput(attrs={'placeholder':'비밀번호 확인','class':'form-control'}), label='')
    field_order=['username','password','password_check','first_name','email']

    class Meta:
        model = User
        fields = ['username','password','first_name','email']
        widgets = {
            'username':forms.TextInput(attrs={'placeholder':'아이디(필명)','class':'form-control'}),
            'password':forms.PasswordInput(attrs={'placeholder':'비밀번호','class':'form-control'}),
            'first_name':forms.TextInput(attrs={'placeholder':'이름','class':'form-control'}),
            'email':forms.TextInput(attrs={'placeholder':'이메일 주소','class':'form-control'}),
        }
        labels = {
            'username':'',
            'password':'',
            'first_name':'',
            'email':'',
        }
        help_texts = {
            'username': '',
            'email': '입력한 메일로 인증 메일을 발송합니다.',
        }

class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ('text',)

        widgets={
            'text':forms.Textarea(attrs={'placeholder':'배려와 매너가 밝은 커뮤니티를 만듭니다.','class':'form-control','rows':5}),
        }
        labels={
            'text':''
        }

class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ('avatar','bio','github','twitter','youtube','facebook','instagram','homepage')

        widgets={
            'bio':forms.Textarea(attrs={'placeholder':'자신을 설명하세요.','class':'form-control','rows':6}),
            'github':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'twitter':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'youtube':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'facebook':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'instagram':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'homepage':forms.TextInput(attrs={'placeholder':'','class':'form-control'}),
            'avatar':forms.FileInput(attrs={'style':'display: none;','class':'form-control', 'required': False})
        }
        labels={
            'avatar':'프로필 이미지',
        }

class ConfigForm(forms.ModelForm):
    class Meta:
        model = Config
        fields = ('agree_email','agree_history','post_fonts','post_theme')

        widgets={
            'agree_email':forms.CheckboxInput(attrs={'class':'custom-control-input'}),
            'agree_history':forms.CheckboxInput(attrs={'class':'custom-control-input'}),
            'post_fonts':forms.Select(attrs={'class':'custom-select'}),
            'post_theme':forms.Select(attrs={'class':'custom-select'}),
        }

class SeriesForm(forms.ModelForm):
    class Meta:
        model = Series
        fields = ('name',)

        widgets={
            'name':forms.TextInput(attrs={'placeholder':'시리즈의 이름','class':'form-control'}),
        }
        labels={
            'name':''
        }

class SeriesPostForm(forms.ModelForm):
    class Meta:
        model = Series
        fields = ('posts',)

        widgets={
            'posts':forms.SelectMultiple(attrs={'class':'custom-select','size':'10'}),
        }
        labels={
            'posts':''
        }