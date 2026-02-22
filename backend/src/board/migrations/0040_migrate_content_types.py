from django.db import migrations


def classify_content_types(apps, schema_editor):
    """
    Classify existing PostContent records into html or markdown.

    Logic:
    - text_md == text_html → html (WYSIWYG editor produced both)
    - text_md != text_html AND text_md starts with '<' → html + sync text_md = text_html
      (legacy 1st-gen HTML stored differently in text_md)
    - otherwise → markdown (text_md contains raw markdown)
    """
    PostContent = apps.get_model('board', 'PostContent')

    for pc in PostContent.objects.all().iterator():
        if pc.text_md == pc.text_html:
            pc.content_type = 'html'
        elif pc.text_md.lstrip().startswith('<'):
            pc.content_type = 'html'
            pc.text_md = pc.text_html
        else:
            pc.content_type = 'markdown'
        pc.save(update_fields=['content_type', 'text_md'])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0039_postcontent_content_type'),
    ]

    operations = [
        migrations.RunPython(classify_content_types, reverse_noop),
    ]
