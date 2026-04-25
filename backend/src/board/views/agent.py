from django.http import HttpRequest, HttpResponse

from board.services.agent_content_service import AgentContentService


def llms_txt(request: HttpRequest) -> HttpResponse:
    content = AgentContentService.build_llms_txt(request)
    response = HttpResponse(content, content_type='text/plain; charset=utf-8')
    response['X-Estimated-Tokens'] = str(AgentContentService.estimate_tokens(content))
    return response


def post_markdown(request: HttpRequest, username: str, post_url: str) -> HttpResponse:
    post = AgentContentService.get_public_post(username, post_url)
    content = AgentContentService.build_post_markdown(post, request)
    response = HttpResponse(content, content_type='text/markdown; charset=utf-8')
    response['X-Estimated-Tokens'] = str(AgentContentService.estimate_tokens(content))
    return response


def series_markdown(request: HttpRequest, username: str, series_url: str) -> HttpResponse:
    series = AgentContentService.get_public_series_detail(username, series_url)
    content = AgentContentService.build_series_markdown(series, request)
    response = HttpResponse(content, content_type='text/markdown; charset=utf-8')
    response['X-Estimated-Tokens'] = str(AgentContentService.estimate_tokens(content))
    return response


def static_page_markdown(request: HttpRequest, slug: str) -> HttpResponse:
    page = AgentContentService.get_public_static_page(slug)
    content = AgentContentService.build_static_page_markdown(page, request)
    response = HttpResponse(content, content_type='text/markdown; charset=utf-8')
    response['X-Estimated-Tokens'] = str(AgentContentService.estimate_tokens(content))
    return response
