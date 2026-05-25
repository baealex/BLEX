from types import SimpleNamespace
from urllib.parse import urlsplit

from django.contrib.sitemaps.views import SitemapIndexItem, x_robots_tag
from django.core.paginator import EmptyPage, PageNotAnInteger
from django.http import Http404, HttpRequest
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.http import http_date

from board.services.site_url_service import SiteUrlService


def get_sitemap_origin(request: HttpRequest) -> tuple[str, str]:
    parsed_origin = urlsplit(SiteUrlService.public_origin(request))
    if parsed_origin.scheme in {'http', 'https'} and parsed_origin.netloc:
        return parsed_origin.scheme, parsed_origin.netloc

    fallback_origin = urlsplit(request.build_absolute_uri('/').rstrip('/'))
    return fallback_origin.scheme or request.scheme, fallback_origin.netloc or request.get_host()


def get_latest_lastmod(current, candidate):
    if current is None or candidate > current:
        return candidate
    return current


@x_robots_tag
def sitemap_index_view(
    request: HttpRequest,
    sitemaps,
    template_name='sitemap_index.xml',
    content_type='application/xml',
    sitemap_url_name='sitemap_section',
):
    protocol, domain = get_sitemap_origin(request)

    sites = []
    all_indexes_lastmod = True
    latest_lastmod = None
    for section, site in sitemaps.items():
        if callable(site):
            site = site()

        sitemap_path = reverse(sitemap_url_name, kwargs={'section': section})
        absolute_url = f'{protocol}://{domain}{sitemap_path}'
        site_lastmod = site.get_latest_lastmod()
        if all_indexes_lastmod:
            if site_lastmod is not None:
                latest_lastmod = get_latest_lastmod(latest_lastmod, site_lastmod)
            else:
                all_indexes_lastmod = False

        sites.append(SitemapIndexItem(absolute_url, site_lastmod))
        for page in range(2, site.paginator.num_pages + 1):
            sites.append(SitemapIndexItem(f'{absolute_url}?p={page}', site_lastmod))

    headers = None
    if all_indexes_lastmod and latest_lastmod:
        headers = {'Last-Modified': http_date(latest_lastmod.timestamp())}

    return TemplateResponse(
        request,
        template_name,
        {'sitemaps': sites},
        content_type=content_type,
        headers=headers,
    )


@x_robots_tag
def sitemap_section_view(
    request: HttpRequest,
    sitemaps,
    section=None,
    template_name='sitemap.xml',
    content_type='application/xml',
):
    protocol, domain = get_sitemap_origin(request)
    sitemap_site = SimpleNamespace(domain=domain)

    if section is not None:
        if section not in sitemaps:
            raise Http404(f'No sitemap available for section: {section!r}')
        maps = [sitemaps[section]]
    else:
        maps = sitemaps.values()

    page = request.GET.get('p', 1)
    lastmod = None
    all_sites_lastmod = True
    urls = []
    for site in maps:
        try:
            if callable(site):
                site = site()
            urls.extend(site.get_urls(page=page, site=sitemap_site, protocol=protocol))
            if all_sites_lastmod:
                site_lastmod = getattr(site, 'latest_lastmod', None)
                if site_lastmod is not None:
                    lastmod = get_latest_lastmod(lastmod, site_lastmod)
                else:
                    all_sites_lastmod = False
        except EmptyPage as error:
            raise Http404(f'Page {page} empty') from error
        except PageNotAnInteger as error:
            raise Http404(f'No page {page!r}') from error

    headers = None
    if all_sites_lastmod and lastmod:
        headers = {'Last-Modified': http_date(lastmod.timestamp())}

    return TemplateResponse(
        request,
        template_name,
        {'urlset': urls},
        content_type=content_type,
        headers=headers,
    )
