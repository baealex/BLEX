from django.conf import settings
from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

from modules.assistant import Assistant

def create_post_description(post_content_html: str):
    post_content = strip_tags(post_content_html)    

    assistant = Assistant(settings.OPENAI_API_KEY)
    answer = assistant.help(message="{\"content\": \"" + post_content + "\"} content에 작성된 내용을 meta description으로 사용할 수 있도록 250자 이내로 요약해주세요.'")

    if answer:
        return answer.replace('\n', ' ')

    return truncatewords(post_content, 50)

