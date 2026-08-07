from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _

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
            'placeholder': _('4–15 lowercase letters or numbers'),
        }),
        label=_('Username'),
    )
    display_name = forms.CharField(
        max_length=150,
        widget=forms.TextInput(attrs={
            'class': input_class,
            'autocomplete': 'name',
            'placeholder': _('Name displayed on the site'),
        }),
        label=_('Display name'),
    )
    email = forms.EmailField(
        max_length=254,
        widget=forms.EmailInput(attrs={
            'class': input_class,
            'autocomplete': 'email',
            'placeholder': _('Administrator email'),
        }),
        label=_('Email'),
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': input_class,
            'autocomplete': 'new-password',
            'placeholder': _('Enter a secure password'),
        }),
        label=_('Password'),
    )
    password_check = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': input_class,
            'autocomplete': 'new-password',
            'placeholder': _('Enter your password again'),
        }),
        label=_('Confirm password'),
    )

    def __init__(self, *args, setup_token: str = '', **kwargs):
        super().__init__(*args, **kwargs)

        if InitialSetupService.requires_setup_token():
            token_is_valid = InitialSetupService.is_valid_setup_token(setup_token)
            widget = forms.HiddenInput() if token_is_valid else forms.PasswordInput(attrs={
                'class': self.input_class,
                'autocomplete': 'off',
                'placeholder': _('Setup token shown in the Docker logs'),
            })

            self.fields['setup_token'] = forms.CharField(
                initial=setup_token,
                required=True,
                widget=widget,
                label=_('Setup token'),
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
                _(
                    'Username must be 4–15 lowercase letters or numbers and '
                    'must not already be in use.'
                )
            )
        return username

    def clean_email(self) -> str:
        email = self.cleaned_data['email']
        try:
            AuthService.validate_email(email)
        except AuthValidationError:
            raise forms.ValidationError(_('Enter a valid email address.'))
        return email

    def clean(self) -> dict:
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_check = cleaned_data.get('password_check')

        if password and password_check and password != password_check:
            raise forms.ValidationError(_('Passwords do not match.'))

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
                self.add_error('setup_token', _('The setup token is incorrect.'))

        return cleaned_data
