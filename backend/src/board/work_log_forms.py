from django import forms
from django.core.files.uploadedfile import UploadedFile
from django.utils.translation import gettext_lazy as _
from PIL import Image, UnidentifiedImageError


class WorkLogForm(forms.Form):
    title = forms.CharField(max_length=100, label=_('Work log title'))


class WorkLogEntryForm(forms.Form):
    max_media_size = 12 * 1024 * 1024
    image_types = {'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}

    title = forms.CharField(max_length=100, required=False, label=_('Entry title'))
    text = forms.CharField(max_length=5000, required=False, label=_('Entry text'))
    attachment = forms.FileField(required=False, label=_('Attachment'))

    def clean_attachment(self) -> tuple[str, UploadedFile | None]:
        attachment: UploadedFile | None = self.cleaned_data.get('attachment')
        if attachment is None:
            return '', None
        if attachment.size > self.max_media_size:
            raise forms.ValidationError(_('Choose an attachment up to 12 MB.'))

        header = attachment.read(12)
        attachment.seek(0)
        if header[4:8] == b'ftyp':
            return 'video/mp4', attachment
        if header.startswith(b'\x1a\x45\xdf\xa3'):
            return 'video/webm', attachment

        try:
            with Image.open(attachment, formats=list(self.image_types)) as image:
                media_type = self.image_types[image.format]
                if image.width * image.height > 20_000_000:
                    raise forms.ValidationError(_('Choose an image up to 20 megapixels.'))
                image.verify()
        except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
            raise forms.ValidationError(_('Choose a PNG, JPEG, WebP, MP4, or WebM file.')) from None

        attachment.seek(0)
        return media_type, attachment

    def clean(self) -> dict:
        data = super().clean()
        if not self.errors and not any(data.get(key) for key in ('title', 'text')) and not data['attachment'][0]:
            raise forms.ValidationError(_('Write a note or add an attachment.'))
        return data


class WorkLogShareForm(forms.Form):
    # Keep one share within the existing form and SQLite parameter limits.
    max_entries = 997

    headline = forms.CharField(max_length=120, label=_('What changed?'))
    selected_entries = forms.CharField(required=False)

    def __init__(self, *args, browsing: bool = False, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields['headline'].required = not browsing
        self.browsing = browsing

    def clean_selected_entries(self) -> set[int]:
        saved = self.cleaned_data['selected_entries']
        values = (saved.split(',') if saved else []) + self.data.getlist('entries')
        if len(values) > self.max_entries:
            raise forms.ValidationError(
                _('Choose up to %(count)s entries for one link.'), params={'count': self.max_entries},
            )
        if any(not value.isascii() or not value.isdecimal() or len(value) > 18 for value in values):
            raise forms.ValidationError(_('Choose entries from this work log.'))
        if not values and not self.browsing:
            raise forms.ValidationError(_('Choose at least one entry to share.'))
        return {int(value) for value in values}
