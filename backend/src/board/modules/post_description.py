from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

from board.models import OpenAIUsageHistory

from modules.assistant import Assistant


def create_post_description(
    post_content_html: str,
    write_type='general',
    api_key=None,
    user=None,
) -> str:
    post_content = strip_tags(post_content_html)

    if write_type == 'detail' and api_key:
        assistant = Assistant(token=api_key)

        query = "{\"content\": \"" + post_content[:4000] + "\"} content에 작성된 내용을 meta description으로 사용할 수 있도록 250자 이내로 요약해주세요."
        response = assistant.help(message=query)

        if response.get('error'):
            print(response)
            if response['error']['code'] == 'invalid_api_key':
                if user and hasattr(user, 'openaiconnection'):
                    user.openaiconnection.delete()
            return truncatewords(post_content, 50)

        if user:
            OpenAIUsageHistory.objects.create(
                user=user,
                query=query,
                response=response,
            )

        response_content = response['choices'][0]['message']['content']
        if response_content:
            return response_content.replace(' 250자', '').replace('250자', '').replace('\n', ' ')

    elif write_type == 'detail' and not api_key:
        print('This need api_key, so it will be truncated by 50 words.')

    return truncatewords(post_content, 50)
