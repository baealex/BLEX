from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from board.services.auth_service import AuthService, AuthValidationError
from board.services.initial_setup_service import InitialSetupService


class InitialAdminSetupForm(forms.Form):
    input_class = (
        'w-full px-4 py-3.5 border border-line rounded-lg '
        'focus:ring-4 focus:ring-line/5 focus:border-line-strong/30 '
        'text-content placeholder-content-hint transition-all duration-200 '
        'bg-surface/40 text-sm font-medium'
    )

    username = forms.CharField(
        max_length=15,
        widget=forms.TextInput(attrs={
            'class': input_class,
            'autocomplete': 'username',
            'placeholder': '4-15자 영문 소문자, 숫자',
        }),
        label='사용자 이름',
    )
    display_name = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': input_class,
            'autocomplete': 'name',
            'placeholder': '사이트에 표시할 이름',
        }),
        label='표시 이름',
    )
    email = forms.EmailField(
        max_length=254,
        widget=forms.EmailInput(attrs={
            'class': input_class,
            'autocomplete': 'email',
            'placeholder': '관리자 이메일',
        }),
        label='이메일',
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': input_class,
            'autocomplete': 'new-password',
            'placeholder': '안전한 비밀번호',
        }),
        label='비밀번호',
    )
    password_check = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': input_class,
            'autocomplete': 'new-password',
            'placeholder': '비밀번호를 다시 입력',
        }),
        label='비밀번호 확인',
    )

    def __init__(self, *args, setup_token: str = '', **kwargs):
        super().__init__(*args, **kwargs)

        if InitialSetupService.requires_setup_token():
            token_is_valid = InitialSetupService.is_valid_setup_token(setup_token)
            widget = forms.HiddenInput() if token_is_valid else forms.PasswordInput(attrs={
                'class': self.input_class,
                'autocomplete': 'off',
                'placeholder': 'Docker 로그에 표시된 설치 토큰',
            })

            self.fields['setup_token'] = forms.CharField(
                initial=setup_token,
                required=True,
                widget=widget,
                label='설치 토큰',
            )
            self.order_fields([
                'setup_token',
                'username',
                'display_name',
                'email',
                'password',
                'password_check',
            ])

    def apply_error_attrs(self) -> None:
        if not self.is_bound:
            return

        for name, field in self.fields.items():
            if self.errors.get(name):
                field.widget.attrs['aria-invalid'] = 'true'
                field.widget.attrs['aria-describedby'] = f'id_{name}_error'

    def clean_username(self) -> str:
        username = self.cleaned_data['username'].lower()
        try:
            AuthService.validate_username(username)
        except AuthValidationError:
            raise forms.ValidationError(
                '사용자 이름은 4-15자의 영문 소문자와 숫자만 사용할 수 있고, 이미 사용 중이면 안 됩니다.'
            )
        return username

    def clean_email(self) -> str:
        email = self.cleaned_data['email']
        try:
            AuthService.validate_email(email)
        except AuthValidationError:
            raise forms.ValidationError('올바른 이메일 주소를 입력해주세요.')
        return email

    def clean(self) -> dict:
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_check = cleaned_data.get('password_check')

        if password and password_check and password != password_check:
            raise forms.ValidationError('비밀번호가 서로 일치하지 않습니다.')

        if password:
            user = User(
                username=cleaned_data.get('username', ''),
                email=cleaned_data.get('email', ''),
                first_name=cleaned_data.get('display_name', ''),
            )
            try:
                validate_password(password, user=user)
            except DjangoValidationError as error:
                raise forms.ValidationError(error.messages)

        if InitialSetupService.requires_setup_token():
            setup_token = cleaned_data.get('setup_token', '')
            if not InitialSetupService.is_valid_setup_token(setup_token):
                self.add_error('setup_token', '설치 토큰이 올바르지 않습니다.')

        return cleaned_data
