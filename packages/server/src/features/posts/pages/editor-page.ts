import { renderApplicationDocument } from '../../../application/document.js';
import { type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SiteHeader, SiteTheme } from '../../../appearance/shell.js';
import { ContentUploadError, saveContentFile } from '../../media/content-media.js';
import { htmlToMarkdown } from '../authoring/markdown.js';
import { parseAuthoringPostInput } from '../services/post-content.js';
import { postTags } from '../services/post-store.js';
import { AuthoringOptions, AuthoringPostInput, EditorModel, POST_DESCRIPTION_MAX, POST_SUBTITLE_MAX, POST_TITLE_MAX, POST_URL_MAX, SeriesOption, StoredPost, UserRow, bodyObject, booleanField, field, h1 } from '../shared.js';

export async function sendEditorPage(
  reply: FastifyReply,
  model: EditorModel,
  statusCode = 200,
  editorAssets?: AuthoringOptions['editorAssets'],
): Promise<void> {
  reply.code(statusCode)
    .type('text/html; charset=utf-8')
    .header('Cache-Control', 'private, no-store')
    .header('X-Robots-Tag', 'noindex, nofollow')
    .header('X-Frame-Options', 'DENY')
    .send(renderEditorPage(model, editorAssets));
}

function editorIcon(name: 'drafts' | 'preview' | 'settings' | 'image' | 'close' | 'publish') {
  const paths: Record<typeof name, string[]> = {
    drafts: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8', 'M8 17h8'],
    preview: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.2-.1a1.7 1.7 0 0 0-1.9.3l-.1.1h-3.4l-.1-.2a1.7 1.7 0 0 0-1.6-1.1 1.7 1.7 0 0 0-1.6 1.1l-.1.2H5.7l-.1-.1a1.7 1.7 0 0 0-1.9-.3l-.2.1-1.7-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.4-1V9.6l.2-.1a1.7 1.7 0 0 0 1.1-1.6 1.7 1.7 0 0 0-1.1-1.6l-.2-.1 1.7-2.9.2.1a1.7 1.7 0 0 0 1.9-.3l.1-.1h3.4l.1.2a1.7 1.7 0 0 0 1.6 1.1 1.7 1.7 0 0 0 1.6-1.1l.1-.2h3.4l.1.1a1.7 1.7 0 0 0 1.9.3l.2-.1 1.7 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.4 1v3.4l-.2.1a1.7 1.7 0 0 0-1.1 1.6 1.7 1.7 0 0 0 1.1 1.6l.2.1z'],
    image: ['M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'm3 16 5-5 4 4 3-3 6 6', 'M8.5 8.5h.01'],
    close: ['m18 6-12 12', 'm6 6 12 12'],
    publish: ['m22 2-7 20-4-9-9-4 20-7z', 'M22 2 11 13'],
  };
  return h1('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    ...paths[name].map((d) => h1('path', { key: d, d })));
}

function renderEditorPage(model: EditorModel, editorAssets?: AuthoringOptions['editorAssets']): string {
  const formAction = model.isEdit ? `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.postUrl)}/edit` : '/write';
const title = model.isEdit ? model.isDraft ? '임시 포스트 수정' : '포스트 수정' : model.isDraft ? '임시 포스트' : '새 포스트';
  const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.postUrl)}`;
  const seriesOptions = [h1('option', { value: '' }, '시리즈 없음'), ...model.seriesOptions.map((series) =>
    h1('option', { value: series.url }, `${series.name} · ${series.url}`))];
  const coverLayouts = [
    ['default', '기본', '제목 다음에 이미지가 자연스럽게 이어집니다.'],
    ['split', '분할', '제목과 대표 이미지를 좌우로 배치합니다.'],
    ['overlay', '이미지 배경', '이미지를 넓게 깔고 제목을 위에 올립니다.'],
    ['none', '커버 숨김', '대표 이미지는 목록과 공유에만 사용합니다.'],
  ];
  const body = h1('html', { lang: 'ko' },
    h1('head', null,
      h1('meta', { charSet: 'utf-8' }),
      h1('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h1('meta', { name: 'robots', content: 'noindex,nofollow' }),
      h1('title', null, `${title} - BLEX`),
      h1(SiteTheme),
      ...(editorAssets?.css ?? []).map((href) => h1('link', { rel: 'stylesheet', href })),
    ),
    h1('body', null,
      h1(SiteHeader, { viewer: { username: model.username, hasEditorRole: true, csrfToken: model.csrfToken }, editorPage: true }),
      h1('div', { className: 'post-editor-page pt-8 pb-40 px-4 md:px-6' },
        h1('div', { className: 'post-detail-layout' },
          h1('aside', { className: 'post-detail-sidebar', 'aria-hidden': true }),
          h1('main', { className: 'post-detail-main' },
            h1('h1', { className: 'sr-only' }, title),
            model.formTitle ? h1('p', { className: 'editor-template-note' }, `“${model.formTitle}” 글 양식을 불러왔습니다.`) : null,
            model.successMessage ? h1('p', { className: 'editor-notice editor-notice-success', role: 'status' }, model.successMessage) : null,
            model.isDraft ? h1('p', { className: 'editor-draft-note' }, '임시 글은 본인에게만 보입니다. 발행하기 전까지는 공개되지 않습니다.') : null,
            model.errorMessage ? h1('p', { className: 'editor-notice editor-notice-error', role: 'alert' }, model.errorMessage) : null,
            h1('form', { id: 'post-editor-form', className: 'post-editor-form', method: 'post', action: formAction },
              h1('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: model.csrfToken }),
              model.isDraft && !model.isEdit ? h1('input', { type: 'hidden', name: 'draft_url', value: model.postUrl }) : null,
              h1('input', { type: 'hidden', name: 'content_type', value: model.contentType }),
              h1('section', {
                className: 'post-editor-cover',
                'data-cover-layout': model.coverLayout,
                'data-cover-image-position': model.coverImagePosition,
                'data-cover-image-ratio': model.coverImageRatio,
              },
              h1('div', { className: 'post-editor-cover-copy' },
                h1('label', { className: 'sr-only', htmlFor: 'editor-title' }, '제목'),
                h1('input', {
                  id: 'editor-title', className: 'editor-title-input', name: 'title', type: 'text',
                  required: !model.isDraft, maxLength: POST_TITLE_MAX, defaultValue: model.title,
                  placeholder: '제목을 입력하세요', autoComplete: 'off',
                }),
                h1('label', { className: 'sr-only', htmlFor: 'editor-subtitle' }, '부제목'),
                h1('input', {
                  id: 'editor-subtitle', className: 'editor-subtitle-input', name: 'subtitle', type: 'text',
                  maxLength: POST_SUBTITLE_MAX, defaultValue: model.subtitle,
                  placeholder: '부제목 (선택사항)', autoComplete: 'off',
                }),
              ),
              h1('div', { className: 'post-editor-cover-image', 'data-cover-empty': !model.coverImageUrl },
                model.coverImageUrl ? h1('img', { id: 'editor-cover-preview', src: model.coverImageUrl, alt: '', 'data-no-filter': true }) : null,
                h1('button', { type: 'button', className: 'editor-cover-picker', 'data-editor-cover-upload': true, 'aria-label': '대표 이미지 추가 또는 변경' },
                  editorIcon('image'),
                  h1('span', null, model.coverImageUrl ? '대표 이미지 변경' : '대표 이미지 추가'),
                  h1('small', null, '이미지 파일을 선택해 올리기')),
                h1('input', {
                  type: 'file', className: 'editor-cover-file-input', accept: 'image/jpeg,image/png,image/gif,image/webp',
                  'data-editor-cover-file': true,
                }),
                h1('span', { className: 'editor-cover-upload-status', role: 'status', 'aria-live': 'polite', 'data-editor-cover-status': true }),
              )),
              h1('details', { className: 'editor-help' },
                h1('summary', null, h1('span', { className: 'editor-help-icon', 'aria-hidden': true }, '✦'), '에디터 사용법'),
                h1('div', { className: 'editor-help-content' },
                  h1('p', null, '본문 도구 모음에서 제목, 목록, 링크, 이미지, 표를 넣을 수 있습니다.'),
                  h1('p', null, '이미지는 도구 모음에서 올리거나 본문에 붙여 넣고 끌어 놓을 수 있습니다.'),
                  h1('p', null, '원본 HTML이나 Markdown을 직접 고치려면 “소스로 편집”을 선택하세요.')),
              ),
              h1('div', { className: 'editor-body-area' },
                h1('div', {
                  id: 'blex-editor-tools',
                  'data-storage-key': `blex-editor:${model.username}:${model.postUrl || 'new'}`,
                  'data-saved': model.savedDraft ? 'true' : undefined,
                  'data-content-type': model.contentType,
                }),
                h1('label', { className: 'editor-source-field' },
                  h1('span', { 'data-editor-source-label': '' }, model.contentType === 'html' ? '본문 소스' : '마크다운 본문'),
                  h1('textarea', {
                    name: 'text_md', required: !model.isDraft,
                    placeholder: '내용을 입력하세요', defaultValue: model.content,
                    'aria-label': model.contentType === 'html' ? '본문 소스' : '마크다운 본문',
                  })),
              ),
              h1('label', { className: 'editor-tags-field' },
                h1('span', null, '태그'),
                h1('input', { name: 'tag', type: 'text', defaultValue: model.tags, placeholder: '태그를 입력하고 쉼표로 구분하세요', autoComplete: 'off' })),
              h1('input', { type: 'hidden', name: 'block_comment', value: 'false' }),
              h1('dialog', { id: 'editor-settings-dialog', className: 'editor-settings-dialog', 'aria-labelledby': 'editor-settings-title' },
                h1('div', { className: 'editor-settings-header' },
                  h1('div', null,
                    h1('h2', { id: 'editor-settings-title' }, '게시 설정'),
                    h1('p', null, '공개 방식과 검색·공유 정보를 관리합니다.')),
                  h1('button', { type: 'button', className: 'editor-icon-button', 'data-editor-close-settings': true, 'aria-label': '닫기' }, editorIcon('close')),
                ),
                h1('div', { className: 'editor-settings-scroll' },
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '발행 설정'),
                    model.showSchedule ? h1('label', { className: 'editor-setting-card' },
                      h1('span', { className: 'editor-setting-copy' },
                        h1('strong', null, '예약 발행'),
                        h1('small', null, '비워 두면 바로 발행됩니다.')),
                      h1('input', { type: 'datetime-local', name: 'reserved_date', defaultValue: model.reservedDate, 'data-schedule-control': true }),
                    ) : h1('p', { className: 'editor-setting-hint' }, '이미 공개된 글은 편집 중인 상태로 유지됩니다.'),
                    h1('label', { className: 'editor-setting-toggle' },
                      h1('span', null, h1('strong', null, '비공개'), h1('small', null, '주소를 아는 사람만 볼 수 있습니다.')),
                      h1('input', { type: 'checkbox', name: 'hide', value: 'on', defaultChecked: model.hide })),
                    h1('label', { className: 'editor-setting-toggle' },
                      h1('span', null, h1('strong', null, '댓글 차단'), h1('small', null, '독자가 새 댓글과 답글을 작성할 수 없습니다.')),
                      h1('input', { type: 'checkbox', name: 'block_comment', value: 'on', defaultChecked: model.blockComment })),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '분류'),
                    h1('label', null, '시리즈', h1('select', { name: 'series', defaultValue: model.series }, ...seriesOptions)),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '커버 스타일'),
                    h1('div', { className: 'editor-cover-layout-options', role: 'group', 'aria-label': '커버 스타일' },
                      ...coverLayouts.map(([value, label, description]) => h1('label', { key: value, className: 'editor-cover-layout-option' },
                        h1('input', { type: 'radio', name: 'cover_layout', value, defaultChecked: model.coverLayout === value }),
                        h1('span', null, h1('strong', null, label), h1('small', null, description))))),
                    h1('div', { className: 'editor-setting-grid' },
                      h1('label', null, '이미지 위치', h1('select', { name: 'cover_image_position', defaultValue: model.coverImagePosition },
                        h1('option', { value: 'right' }, '오른쪽'), h1('option', { value: 'left' }, '왼쪽'))),
                      h1('label', null, '이미지 비율', h1('select', { name: 'cover_image_ratio', defaultValue: model.coverImageRatio },
                        h1('option', { value: 'auto' }, '원본 비율'), h1('option', { value: '16:9' }, '16:9'),
                        h1('option', { value: '4:3' }, '4:3'), h1('option', { value: '1:1' }, '1:1'),
                        h1('option', { value: '3:4' }, '3:4'))),
                    ),
                    h1('label', { className: 'editor-cover-url-field' }, '대표 이미지 URL',
                      h1('input', { name: 'cover_image_url', type: 'text', inputMode: 'url', defaultValue: model.coverImageUrl, placeholder: '/resources/media/…', 'data-cover-url': true }),
                      h1('span', { className: 'editor-setting-hint' }, '이미지를 먼저 올린 뒤 주소를 붙여 넣으세요.'),
                      h1('a', { href: '/write/images', target: '_blank', rel: 'noopener noreferrer' }, '이미지·동영상 올리기')),
                    h1('label', { className: 'editor-setting-toggle editor-remove-image' },
                      h1('span', null, h1('strong', null, '대표 이미지 삭제'), h1('small', null, '공유와 목록에서 이 이미지를 사용하지 않습니다.')),
                      h1('input', { type: 'checkbox', name: 'remove_cover_image', value: 'on' })),
                  ),
                  h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '검색 및 공유'),
                    h1('label', null, 'URL', h1('input', { name: 'url', maxLength: POST_URL_MAX, defaultValue: model.postUrl, placeholder: '자동 생성' })),
                    h1('label', null, '검색·공유 설명', h1('textarea', { name: 'meta_description', maxLength: POST_DESCRIPTION_MAX, defaultValue: model.description, placeholder: '포스트를 소개하는 설명을 입력하세요' })),
                  ),
                  model.isEdit ? h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '이 글 관리'),
                    h1('nav', { className: 'editor-settings-links', 'aria-label': '글 도구' },
                      !model.isDraft ? h1('a', { href: `${postPath}/revisions` }, '수정 기록') : null,
                      !model.isDraft ? h1('a', { href: `${postPath}/timelapse` }, '작성 타임라인') : null,
                      h1('a', { href: '/settings/posts' }, '글 관리'),
                      h1('a', { href: '/settings/forms' }, '글 양식'),
                      h1('a', { href: '/settings/developer-api' }, '개발자 API'),
                      h1('a', { href: '/docs/developer-api/quickstart' }, 'API 빠른 시작')),
                  ) : h1('section', { className: 'editor-settings-section' },
                    h1('h3', null, '도움말'),
                    h1('nav', { className: 'editor-settings-links', 'aria-label': '글 작성 도움말' },
                      h1('a', { href: '/settings/drafts' }, '임시 글 열기'),
                      h1('a', { href: '/settings/forms' }, '글 양식'),
                      h1('a', { href: '/settings/developer-api' }, '개발자 API'),
                      h1('a', { href: '/docs/developer-api/quickstart' }, 'API 빠른 시작')),
                  ),
                ),
                h1('div', { className: 'editor-settings-footer' },
                  h1('button', { type: 'button', className: 'editor-settings-done', 'data-editor-close-settings': true }, '완료')),
              ),
              h1('div', { className: 'editor-action-dock' },
                h1('div', { className: 'editor-action-bar', 'aria-label': '글 작업' },
                  !model.isEdit ? h1('a', { href: '/settings/drafts', className: 'editor-action-icon', 'aria-label': '임시 글', title: '임시 글' }, editorIcon('drafts')) : null,
                  h1('button', { type: 'button', className: 'editor-action-icon', 'data-editor-preview': true, 'aria-label': '미리보기', title: '미리보기' }, editorIcon('preview')),
                  h1('button', { type: 'button', className: 'editor-action-icon', 'data-editor-open-settings': true, 'aria-label': '게시 설정', title: '게시 설정' }, editorIcon('settings')),
                  h1('span', { className: 'editor-action-separator', 'aria-hidden': true }),
                  h1('span', { className: 'editor-save-status', role: 'status', 'aria-live': 'polite', 'data-editor-save-status': true }, '이 기기에 복구 저장'),
                  (!model.isEdit || model.isDraft) ? h1('button', { type: 'submit', className: 'editor-action-secondary', name: 'action', value: 'draft', formNoValidate: true }, '임시 저장') : null,
                  h1('button', { type: 'submit', className: 'editor-action-publish', name: 'action', value: 'publish' },
                    editorIcon('publish'), model.isEdit && !model.isDraft ? '수정사항 저장' : '발행'),
                  model.isEdit ? h1('button', { type: 'submit', className: 'editor-action-delete', name: 'action', value: 'delete', formNoValidate: true }, '휴지통') : null,
                ),
              ),
            ),
            model.isDraft && model.postUrl ? h1('p', { className: 'editor-preview-link' }, h1('a', { href: `/write/preview/${encodeURIComponent(model.postUrl)}` }, '별도 화면에서 미리보기')) : null,
          ),
          h1('aside', { className: 'post-detail-sidebar', 'aria-hidden': true }),
        ),
      ),
      editorAssets?.script ? h1('script', { type: 'module', src: editorAssets.script, 'data-blex-page-module': 'editor' }) : null,
    ),
  );
  return renderApplicationDocument(body);
}

function h2Safe(value: string) {
  return h1('h2', null, value);
}

export function inputFromEditorForm(body: Record<string, unknown>): AuthoringPostInput {
  return {
    ...parseAuthoringPostInput(body),
    text: field(body.text_md) || field(body.content_html),
    contentType: field(body.content_type) || (Object.hasOwn(body, 'text_md') ? 'markdown' : 'html'),
    description: field(body.meta_description),
    url: field(body.url),
    tags: field(body.tag),
    series: field(body.series),
    hide: booleanField(body.hide),
    blockComment: booleanField(body.block_comment),
    coverLayout: field(body.cover_layout) || 'default',
    coverImagePosition: field(body.cover_image_position) || 'right',
    coverImageRatio: field(body.cover_image_ratio) || 'auto',
    coverImage: Object.hasOwn(body, 'cover_image_url') ? field(body.cover_image_url) : undefined,
    removeCoverImage: booleanField(body.remove_cover_image),
  };
}

// The 3.x editor posts whole documents; Django accepted them up to the proxy limit.
export const editorBodyLimit = 13 * 1024 * 1024;

interface EditorForm {
  body: Record<string, unknown>;
  image?: { buffer: Buffer; filename: string };
}

export async function readEditorForm(request: FastifyRequest): Promise<EditorForm> {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/form-data')) {
    return { body: bodyObject(request.body) };
  }
  const body: Record<string, unknown> = {};
  let image: EditorForm['image'];
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.fieldname === 'image' && part.filename && buffer.length) image = { buffer, filename: part.filename };
    } else body[part.fieldname] = part.value;
  }
  request.body = body;
  return { body, image };
}

/** Maps the 3.x editor's series id and cover file onto the fields the save path understands. */
export async function prepareEditorFields(db: PrismaClient, options: AuthoringOptions, account: UserRow, form: EditorForm): Promise<string | null> {
  const { body, image } = form;
  if (Object.hasOwn(body, 'content_html') && !Object.hasOwn(body, 'text_md')) {
    const seriesId = field(body.series);
    const [series] = /^\d+$/.test(seriesId)
      ? await db.$queryRaw<Array<{ url: string }>>`SELECT url FROM board_series WHERE id = ${Number(seriesId)} AND owner_id = ${account.id} LIMIT 1`
      : [];
    body.series = series?.url ?? '';
  }
  if (image) {
    try {
      body.cover_image_url = await saveContentFile(db, options.mediaRoot, account.id, image);
    } catch (error) {
      if (error instanceof ContentUploadError) return error.message;
      throw error;
    }
  } else if (booleanField(body.image_delete) || booleanField(body.remove_image)) body.remove_cover_image = 'true';
  return null;
}

export function editorKeepsOriginalContent(post: StoredPost, body: Record<string, unknown>): boolean {
  if (!Object.hasOwn(body, 'text_md')) return false;
  return field(body.text_md) === (field(body.content_type) === 'html' ? post.contentHtml : htmlToMarkdown(post.contentHtml));
}

export async function editorKeepsOriginalTags(db: PrismaClient, post: StoredPost, body: Record<string, unknown>): Promise<boolean> {
  return Object.hasOwn(body, 'tag') && field(body.tag) === (await postTags(db, post.id)).join(', ');
}

export function editorModel(
  account: UserRow,
  csrfToken: string,
  seriesOptions: SeriesOption[],
  values: Partial<EditorModel> = {},
): EditorModel {
  return {
    action: 'publish',
    csrfToken,
    content: '',
    contentType: 'markdown',
    description: '',
    errorMessage: '',
    successMessage: '',
    savedDraft: false,
    isDraft: false,
    isEdit: false,
    postUrl: '',
    series: '',
    seriesOptions,
    tags: '',
    title: '',
    username: account.username,
    subtitle: '',
    hide: false,
    blockComment: false,
    coverLayout: 'default',
    coverImagePosition: 'right',
    coverImageRatio: 'auto',
    reservedDate: '',
    showSchedule: true,
    formTitle: '',
    coverImageUrl: '',
    ...values,
  };
}
