import { createElement, type ReactNode } from 'react';
import { SiteIcon } from '../appearance/shell.js';
import { renderSettingsShell, type SettingsShellCapabilities, type SettingsShellOptions } from '../settings-shell.js';

export interface AdminSettingsUser {
  id: number;
  username: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
}

export interface AdminCapabilities {
  canManageSiteSettings: boolean;
  canManageLoginSettings: boolean;
  canManageInvites?: boolean;
  canManageSiteContent?: boolean;
  canManageIntegrationSettings?: boolean;
  canManageGlobalWebhook?: boolean;
  canManageUtilities?: boolean;
  canManageScripts: boolean;
}

export interface AdminInvite {
  id: number;
  code: string;
  note: string;
  signupUrl: string;
  isActive: boolean;
  isClaimed: boolean;
  createdBy: string;
  claimedBy: string;
  createdDate: string | null;
  claimedDate: string | null;
}

export interface AdminStaticPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  isPublished: boolean;
  showInFooter: boolean;
  order: number;
  createdDate: string;
  updatedDate: string;
}

export interface AdminNotice {
  id: number;
  title: string;
  url: string;
  isActive: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface AdminBanner {
  id: number;
  title: string;
  contentHtml: string;
  bannerType: string;
  position: string;
  isActive: boolean;
  order: number;
  createdDate: string;
  updatedDate: string;
  createdBy: string | null;
}

export interface AdminManagedUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: 'READER' | 'EDITOR';
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  canChangeRole: boolean;
  postCount: number;
  dateJoined: string | null;
  lastLogin: string | null;
}

export interface AdminUserList {
  users: AdminManagedUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  stats: { total: number; editors: number; readers: number; admins: number };
}

export interface AdminIntegrationSettings {
  telegramEnabled: boolean;
  telegramBotUsername: string;
  telegramHasBotToken: boolean;
  updatedDate: string;
  telegramConnection: { state: string; detail: string };
}

export interface AdminSiteSettings {
  siteName: string;
  siteDescription: string;
  logoSvgUrl: string;
  logoSvgDarkUrl: string;
  iconSvgUrl: string;
  iconSvgDarkUrl: string;
  faviconUrl: string;
  iconPngUrls: Record<string, string>;
  hasCustomLogo: boolean;
  hasCustomLogoDark: boolean;
  hasCustomIcon: boolean;
  hasCustomIconDark: boolean;
  headerScript: string;
  footerScript: string;
  canManageScripts: boolean;
  seoEnabled: boolean;
  robotsTxtExtraRules: string;
  robotsTxtDefault: string;
  aeoEnabled: boolean;
  updatedDate: string;
}

export interface AdminSocialProvider {
  key: string;
  name: string;
  isEnabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
}

export interface AdminLoginSettings {
  welcomeNotificationMessage: string;
  welcomeNotificationUrl: string;
  accountDeletionRedirectUrl: string;
  hcaptchaEnabled: boolean;
  hcaptchaSiteKey: string;
  hcaptchaHasSecretKey: boolean;
  updatedDate: string;
  socialAuthProviders: AdminSocialProvider[];
}

export type AdminSettingsPage = 'site' | 'seo' | 'login' | 'integrations' | 'global-webhook' | 'utilities' | 'users' | 'static-pages' | 'notices' | 'banners' | 'author-notices' | 'author-banners';

const h = createElement;

function shell(
  title: string,
  user: AdminSettingsUser,
  page: AdminSettingsPage,
  capabilities: AdminCapabilities,
  content: ReactNode,
  csrfToken = '',
  brand?: SettingsShellOptions['brand'],
): string {
  const currentPaths: Record<AdminSettingsPage, string> = {
    site: '/admin-settings/site-settings',
    seo: '/admin-settings/seo-aeo',
    login: '/admin-settings/login',
    integrations: '/admin-settings/integrations',
    'global-webhook': '/admin-settings/global-webhook',
    utilities: '/admin-settings/utilities',
    users: '/admin-settings/users',
    'static-pages': '/admin-settings/static-pages',
    notices: '/admin-settings/global-notices',
    banners: '/admin-settings/global-banners',
    'author-notices': '/settings/notices',
    'author-banners': '/settings/banners',
  };
  return renderSettingsShell({
    mode: 'admin', title, currentPath: currentPaths[page], user,
    csrfToken, brand, content, capabilities: capabilities as SettingsShellCapabilities,
  });
}

function csrfInput(csrfToken: string) {
  return h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: csrfToken });
}

const settingsErrors = new Map([
  ['Site name must be 80 characters or fewer.', '사이트 이름은 80자 이하로 입력해 주세요.'],
  ['Superuser access is required.', '최고 관리자 권한이 필요합니다.'],
  ['Enter a valid notification URL.', '올바른 알림 주소를 입력해 주세요.'],
  ['Notification URLs cannot contain control characters.', '알림 주소에는 제어 문자를 사용할 수 없습니다.'],
  ['Notification URLs cannot contain backslashes.', '알림 주소에는 역슬래시를 사용할 수 없습니다.'],
  ['Notification URLs must be a relative path or an HTTP(S) URL.', '상대 경로나 HTTP(S) 주소를 입력해 주세요.'],
  ['Enter an hCaptcha Site Key.', 'hCaptcha 사이트 키를 입력해 주세요.'],
  ['Enter an hCaptcha Secret Key.', 'hCaptcha 비밀 키를 입력해 주세요.'],
  ['Enter a Telegram bot token.', '텔레그램 봇 토큰을 입력해 주세요.'],
  ['Enter a valid Telegram bot token.', '유효한 텔레그램 봇 토큰을 입력해 주세요.'],
  ['Telegram rejected this bot token. Check the token and try again.', '텔레그램에서 토큰을 거부했습니다. 토큰을 확인해 주세요.'],
  ['SVG file is required.', 'SVG 파일을 선택해 주세요.'],
  ['SVG file is too large.', 'SVG 파일이 너무 큽니다.'],
  ['This is not a valid SVG file.', '유효한 SVG 파일을 선택해 주세요.'],
  ['SVG files require a viewBox.', 'SVG 파일에 viewBox를 지정해 주세요.'],
  ['The SVG structure is too complex.', 'SVG 구조가 너무 복잡합니다.'],
  ['The SVG contains an external reference or unsafe value.', 'SVG에 외부 참조 또는 안전하지 않은 값이 들어 있습니다.'],
  ['The SVG contains an event handler attribute.', 'SVG의 이벤트 속성을 제거해 주세요.'],
  ['The SVG text contains an unsafe value.', 'SVG 텍스트에 안전하지 않은 값이 들어 있습니다.'],
  ['SVG processing instructions and DOCTYPE declarations are not allowed.', 'SVG의 처리 명령과 DOCTYPE 선언을 제거해 주세요.'],
  ['Check the SVG root element.', 'SVG 최상위 요소를 확인해 주세요.'],
  ['Could not generate icon files from the SVG.', 'SVG에서 아이콘을 만들 수 없습니다. 파일 크기와 viewBox를 확인해 주세요.'],
  ['Upload the default asset first.', '기본 이미지를 먼저 업로드해 주세요.'],
  ['Choose a brand asset action.', '브랜드 자산에서 수행할 작업을 선택해 주세요.'],
  ['Check the brand asset type.', '브랜드 자산 유형을 확인해 주세요.'],
  ['Check the brand asset theme.', '브랜드 자산 테마를 확인해 주세요.'],
  ['Brand asset storage is unavailable.', '브랜드 자산 저장소를 사용할 수 없습니다.'],
  ['Invitation link not found.', '초대 링크를 찾을 수 없습니다.'],
  ['A used invitation link cannot be deleted.', '사용된 초대 링크는 삭제할 수 없습니다.'],
  ['User not found.', '회원을 찾을 수 없습니다.'],
  ['You cannot change your own role.', '내 권한은 여기에서 변경할 수 없습니다.'],
  ['Administrator roles cannot be changed from this page.', '관리자 권한은 여기에서 변경할 수 없습니다.'],
  ['This role is not supported.', '지원하지 않는 회원 권한입니다.'],
  ['Enter a title.', '제목을 입력해 주세요.'],
  ['Enter a URL slug.', 'URL 슬러그를 입력해 주세요.'],
  ['This slug is already in use.', '이미 사용 중인 URL 슬러그입니다.'],
  ['Static page not found.', '정적 페이지를 찾을 수 없습니다.'],
  ['Enter a notice title.', '공지 제목을 입력해 주세요.'],
  ['Enter a URL.', '이동할 주소를 입력해 주세요.'],
  ['Notice not found.', '공지를 찾을 수 없습니다.'],
  ['Enter a banner name.', '배너 이름을 입력해 주세요.'],
  ['Enter banner HTML.', '배너 HTML을 입력해 주세요.'],
  ['Banner not found.', '배너를 찾을 수 없습니다.'],
  ['Horizontal banners can only be placed at the top or bottom.', '가로형 배너는 위나 아래에 배치해 주세요.'],
  ['Sidebar banners can only be placed on the left or right.', '사이드바 배너는 왼쪽이나 오른쪽에 배치해 주세요.'],
  ['Choose a valid maintenance task.', '실행할 정리 작업을 선택해 주세요.'],
  ['A signed-in session is required.', '다시 로그인해 주세요.'],
  ['Image cleanup storage is unavailable.', '이미지 저장소를 사용할 수 없습니다.'],
  ['The cleanup preview has expired or is invalid.', '정리 미리보기가 만료됐습니다. 대상을 다시 확인해 주세요.'],
]);

function settingsErrorMessage(message: string): string {
  if (/[가-힣]/.test(message)) return message;
  if (message.startsWith('Unsupported SVG element: ')) return `허용되지 않는 SVG 요소입니다 (${message.slice('Unsupported SVG element: '.length)}).`;
  if (message.startsWith('Unsupported SVG attribute: ')) return `허용되지 않는 SVG 속성입니다 (${message.slice('Unsupported SVG attribute: '.length)}).`;
  return settingsErrors.get(message) ?? '요청을 처리하지 못했습니다. 입력 내용을 확인해 주세요.';
}

const koreanDate = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });

function settingsDate(value: string): string {
  const iso = value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(date.valueOf()) ? koreanDate.format(date) : value;
}

function statusNotice(saved: boolean, error?: string) {
  if (error) return h('p', { className: 'status error', role: 'alert' }, settingsErrorMessage(error));
  if (saved) return h('p', { className: 'status success', role: 'status' }, '설정을 저장했습니다.');
  return null;
}

function BrandAssetSlot({ type, theme, url, custom, uploadEnabled, csrfToken }: {
  type: 'logo' | 'icon';
  theme: 'default' | 'dark';
  url: string;
  custom: boolean;
  uploadEnabled: boolean;
  csrfToken: string;
}) {
  const id = `brand-${type}-${theme}`;
  const label = theme === 'dark' ? '다크 모드' : '기본';
  const action = '/admin-settings/brand-assets';
  const fields = <>
    {csrfInput(csrfToken)}
    <input type="hidden" name="asset_type" value={type} />
    <input type="hidden" name="theme" value={theme} />
  </>;
  return <div className="space-y-3 rounded-xl bg-surface-subtle p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-content-secondary">{label}</span>
      <span className="text-[11px] font-medium text-content-hint">{custom ? '커스텀' : '기본값'}</span>
    </div>
    <div data-theme={theme === 'dark' ? 'dark' : 'light'} className="flex h-24 items-center justify-center rounded-xl bg-surface p-4">
      <img src={url} alt="" data-no-filter="" className={type === 'icon' ? 'size-14 object-contain' : 'max-h-12 max-w-full object-contain'} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <form method="post" action={action} encType="multipart/form-data" data-settings-brand-upload="">
        {fields}
        <input id={id} className="peer sr-only" type="file" name="svg" accept=".svg,image/svg+xml"
          aria-label={`${label} ${type === 'logo' ? '로고' : '아이콘'} SVG 업로드`} required disabled={!uploadEnabled} />
        <label htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-content hover:bg-surface-subtle peer-focus-visible:outline-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 [@media(pointer:fine)]:min-h-9">
          <SiteIcon name="upload" className="text-xs" /> 업로드
        </label>
        <noscript><button type="submit" disabled={!uploadEnabled}>업로드 저장</button></noscript>
      </form>
      {custom && <form method="post" action={action}>
        {fields}<input type="hidden" name="_delete" value="true" />
        <button type="submit" className="secondary-button">삭제</button>
      </form>}
    </div>
  </div>;
}

export function renderAdminSiteSettings(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  settings: AdminSiteSettings;
  csrfToken: string;
  brandAssetsEnabled?: boolean;
  saved?: boolean;
  error?: string;
}): string {
  const { settings } = props;
  const canUploadBrandAssets = props.brandAssetsEnabled !== false;
  const assets = [
    { type: 'logo' as const, title: '로고', help: '헤더와 푸터에 쓰입니다. 다크 모드 SVG는 기본 로고를 올린 뒤 선택적으로 지정합니다.',
      defaultUrl: settings.logoSvgUrl, darkUrl: settings.logoSvgDarkUrl, hasDefault: settings.hasCustomLogo, hasDark: settings.hasCustomLogoDark },
    { type: 'icon' as const, title: '아이콘', help: '기본 아이콘 SVG를 올리면 파비콘과 PNG 아이콘도 함께 생성합니다.',
      defaultUrl: settings.iconSvgUrl, darkUrl: settings.iconSvgDarkUrl, hasDefault: settings.hasCustomIcon, hasDark: settings.hasCustomIconDark },
  ];
  const formId = 'site-settings-form';
  return shell('블로그 꾸미기', props.user, 'site', props.capabilities, <div className="space-y-8">
    {statusNotice(props.saved ?? false, props.error)}
    <form id={formId} method="post" action="/admin-settings/site-settings" data-site-settings-form="">{csrfInput(props.csrfToken)}</form>
    <section className="space-y-4" aria-labelledby="site-name-heading">
      <h2 id="site-name-heading" className="text-base font-semibold text-content">기본 설정</h2>
      <div className="panel">
        <div className="space-y-2">
          <label htmlFor="site-name">사이트 이름</label>
          <input id="site-name" name="site_name" form={formId} maxLength={80} defaultValue={settings.siteName} placeholder="BLEX" />
          <p className="muted">브라우저 제목, 검색 결과, RSS, 공개 문서에 표시됩니다.</p>
        </div>
      </div>
    </section>
    <section className="space-y-4" aria-labelledby="brand-preview-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="brand-preview-heading" className="text-base font-semibold text-content">브랜드 자산</h2>
        {canUploadBrandAssets && <p className="text-xs text-content-secondary">업로드와 삭제는 별도 저장 없이 즉시 반영됩니다.</p>}
      </div>
      {!canUploadBrandAssets && <p className="muted">브랜드 자산을 저장할 경로가 설정되지 않았습니다.</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {assets.map((asset) => <div key={asset.type} className="space-y-4 rounded-2xl bg-surface p-6 ring-1 ring-line/60">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-content-secondary">
              <SiteIcon name={asset.type === 'logo' ? 'photo' : 'palette'} />
            </span>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-content">{asset.title}</h3>
              <p className="text-sm leading-relaxed text-content-secondary">{asset.help}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <BrandAssetSlot type={asset.type} theme="default" url={asset.defaultUrl} custom={asset.hasDefault}
              uploadEnabled={canUploadBrandAssets} csrfToken={props.csrfToken} />
            <BrandAssetSlot type={asset.type} theme="dark" url={asset.darkUrl} custom={asset.hasDark}
              uploadEnabled={canUploadBrandAssets && asset.hasDefault} csrfToken={props.csrfToken} />
          </div>
        </div>)}
      </div>
    </section>
    {settings.canManageScripts && <section className="space-y-4" aria-labelledby="global-code-heading">
      <h2 id="global-code-heading" className="text-base font-semibold text-content">고급 설정</h2>
      <details className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60">
        <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-6 py-5 md:px-8 [&::-webkit-details-marker]:hidden">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-surface text-warning"><SiteIcon name="code" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-content">전역 코드</span>
            <span className="mt-1 block text-sm text-content-secondary">
              {settings.headerScript || settings.footerScript ? '현재 모든 공개 페이지에 적용 중입니다.' : '현재 설정된 코드가 없습니다.'}
            </span>
          </span>
          <SiteIcon name="chevron-down" className="size-5 shrink-0 text-content-hint transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-line px-6 py-6 md:px-8 md:py-8">
          <p className="rounded-xl border border-warning-line bg-warning-surface p-4 text-xs leading-relaxed text-warning">
            검증된 코드를 사용하세요. 저장하면 모든 공개 페이지에 적용됩니다.
          </p>
          <div className="space-y-2"><label htmlFor="header-script">Head 영역 코드</label><textarea id="header-script" name="header_script" form={formId}
            className="font-mono" rows={8} defaultValue={settings.headerScript} /></div>
          <div className="space-y-2"><label htmlFor="footer-script">Body 하단 코드</label><textarea id="footer-script" name="footer_script" form={formId}
            className="font-mono" rows={8} defaultValue={settings.footerScript} /></div>
        </div>
      </details>
    </section>}
    <div className="sticky bottom-0 z-10 -mx-4 flex justify-end bg-surface-page/95 px-4 py-3 backdrop-blur md:mx-0 md:px-0">
      <button type="submit" form={formId} className="w-full sm:w-auto" data-site-settings-save="">사이트 설정 저장</button>
    </div>
  </div>, props.csrfToken, { siteName: settings.siteName, logoUrl: settings.logoSvgUrl, darkLogoUrl: settings.logoSvgDarkUrl });
}

export function renderAdminSeoSettings(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  settings: AdminSiteSettings;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('SEO/AEO', props.user, 'seo', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="exposure-heading">
      <h2 id="exposure-heading">검색과 에이전트 노출</h2>
      <form method="post" action="/admin-settings/seo-aeo">
        {csrfInput(props.csrfToken)}
        <p className="field"><label><input type="checkbox" name="seo_enabled" value="true" defaultChecked={props.settings.seoEnabled} /> 검색 엔진 색인 허용</label></p>
        <p className="muted">끄면 공개 페이지에 색인 제외를 표시하고 사이트맵을 제공하지 않습니다.</p>
        <p className="field"><label><input type="checkbox" name="aeo_enabled" value="true" defaultChecked={props.settings.aeoEnabled} /> AI 에이전트용 리소스 제공</label></p>
        <p className="muted">llms.txt, 마크다운 주소, 발견용 헤더와 관련 robots.txt 규칙을 설정합니다.</p>
        <div className="field"><label htmlFor="robots-extra-rules">robots.txt 추가 규칙</label><textarea id="robots-extra-rules" name="robots_txt_extra_rules" defaultValue={props.settings.robotsTxtExtraRules} /></div>
        <div className="actions"><button type="submit">노출 설정 저장</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="robots-default-heading">
      <h2 id="robots-default-heading">기본 robots.txt 규칙</h2>
      <pre>{props.settings.robotsTxtDefault}</pre>
    </section>
  </>, props.csrfToken);
}

export function renderAdminLoginSettings(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  settings: AdminLoginSettings;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('로그인 관리', props.user, 'login', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <form method="post" action="/admin-settings/login" autoComplete="off">
      {csrfInput(props.csrfToken)}
      <section className="panel" aria-labelledby="member-experience-heading">
        <h2 id="member-experience-heading">회원 설정</h2>
        <div className="field"><label htmlFor="welcome-message">가입 환영 알림</label><textarea id="welcome-message" name="welcome_notification_message" defaultValue={props.settings.welcomeNotificationMessage} /></div>
        <div className="grid">
          <div className="field"><label htmlFor="welcome-url">가입 환영 알림 주소</label><input id="welcome-url" name="welcome_notification_url" maxLength={255} defaultValue={props.settings.welcomeNotificationUrl} /></div>
          <div className="field"><label htmlFor="deletion-url">회원 탈퇴 후 이동 주소</label><input id="deletion-url" name="account_deletion_redirect_url" maxLength={500} defaultValue={props.settings.accountDeletionRedirectUrl} /></div>
        </div>
      </section>
      <section className="panel" aria-labelledby="hcaptcha-heading">
        <h2 id="hcaptcha-heading">hCaptcha</h2>
        <p className="field"><label><input type="checkbox" name="hcaptcha_enabled" value="true" defaultChecked={props.settings.hcaptchaEnabled} /> 회원가입에 hCaptcha 적용</label></p>
        <div className="field"><label htmlFor="hcaptcha-site-key">사이트 키</label><input id="hcaptcha-site-key" name="hcaptcha_site_key" maxLength={255} defaultValue={props.settings.hcaptchaSiteKey} /></div>
        <div className="field"><label htmlFor="hcaptcha-secret-key">새 비밀 키</label><input id="hcaptcha-secret-key" name="hcaptcha_secret_key" type="password" autoComplete="new-password" placeholder={props.settings.hcaptchaHasSecretKey ? '기존 키를 유지하려면 비워 두세요.' : '설정되지 않음'} /></div>
        <p className="muted">{props.settings.hcaptchaHasSecretKey ? '비밀 키가 저장돼 있습니다.' : '저장된 비밀 키가 없습니다.'}</p>
        <label><input type="checkbox" name="clear_hcaptcha_secret_key" value="true" /> 저장된 hCaptcha 비밀 키 삭제</label>
      </section>
      <section className="panel" aria-labelledby="social-login-heading">
        <h2 id="social-login-heading">소셜 로그인 제공자</h2>
        {props.settings.socialAuthProviders.map((provider) => <div className="provider" key={provider.key}>
          <h3>{provider.name}</h3>
          <p><label><input type="checkbox" name={`provider_${provider.key}_enabled`} value="true" defaultChecked={provider.isEnabled} /> {provider.name} 로그인 사용</label></p>
          <div className="field"><label htmlFor={`${provider.key}-client-id`}>클라이언트 ID</label><input id={`${provider.key}-client-id`} name={`provider_${provider.key}_client_id`} maxLength={255} defaultValue={provider.clientId} /></div>
          <div className="field"><label htmlFor={`${provider.key}-client-secret`}>새 클라이언트 비밀 키</label><input id={`${provider.key}-client-secret`} name={`provider_${provider.key}_client_secret`} type="password" autoComplete="new-password" placeholder={provider.hasClientSecret ? '기존 키를 유지하려면 비워 두세요.' : '설정되지 않음'} /></div>
          <p className="muted">{provider.hasClientSecret ? '클라이언트 비밀 키가 저장돼 있습니다.' : '저장된 클라이언트 비밀 키가 없습니다.'}</p>
          <label><input type="checkbox" name={`provider_${provider.key}_clear_secret`} value="true" /> 저장된 {provider.name} 비밀 키 삭제</label>
        </div>)}
      </section>
      <div className="actions"><button type="submit">로그인 설정 저장</button></div>
    </form>
  </>, props.csrfToken);
}

export function renderAdminIntegrationSettings(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  settings: AdminIntegrationSettings;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  const connection = props.settings.telegramConnection;
  const stateLabels: Record<string, string> = {
    disabled: '사용 안 함', not_connected: '연결 안 됨', connected: '연결됨', unreachable: '연결할 수 없음',
    invalid_token: '유효하지 않은 토큰', rejected: '요청 거부됨', delivery_failed: '알림 전송 실패',
  };
  return shell('텔레그램 연동', props.user, 'integrations', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="telegram-status-heading">
      <h2 id="telegram-status-heading">봇 연결 상태</h2>
      <p>연결 상태 <strong>{stateLabels[connection.state] ?? '알 수 없음'}</strong></p>
      <p className="muted">{connection.state === 'disabled'
        ? '텔레그램 연동을 켜고 토큰을 저장하면 웹훅을 등록합니다.'
        : '토큰 확인을 마치면 사이트에서 웹훅을 관리합니다.'}</p>
    </section>
    <section className="panel" aria-labelledby="telegram-settings-heading">
      <h2 id="telegram-settings-heading">사이트 텔레그램 봇</h2>
      <form method="post" action="/admin-settings/integrations" autoComplete="off">
        {csrfInput(props.csrfToken)}
        <p className="field"><label><input type="checkbox" name="telegram_enabled" value="true" defaultChecked={props.settings.telegramEnabled} /> 텔레그램 연동 사용</label></p>
        <div className="field"><label htmlFor="telegram-bot-username">봇 사용자 이름</label><input id="telegram-bot-username" name="telegram_bot_username" maxLength={64} defaultValue={props.settings.telegramBotUsername} placeholder="@example_bot" /></div>
        <div className="field"><label htmlFor="telegram-bot-token">새 봇 토큰</label><input id="telegram-bot-token" name="telegram_bot_token" type="password" autoComplete="new-password" placeholder={props.settings.telegramHasBotToken ? '기존 토큰을 유지하려면 비워 두세요.' : '설정되지 않음'} /></div>
        <p className="muted">{props.settings.telegramHasBotToken ? '봇 토큰이 저장돼 있습니다.' : '저장된 봇 토큰이 없습니다.'}</p>
        <label><input type="checkbox" name="clear_telegram_bot_token" value="true" /> 저장된 봇 토큰 삭제</label>
        <div className="actions"><button type="submit">저장하고 연결 확인</button></div>
      </form>
    </section>
  </>, props.csrfToken);
}

export function renderAdminInvites(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  invites: AdminInvite[];
  managedUsers?: AdminUserList;
  query?: string;
  roleFilter?: string;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('사용자 권한', props.user, 'users', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    {props.managedUsers && <section className="panel" aria-labelledby="managed-users-heading">
      <h2 id="managed-users-heading">회원 권한</h2>
      <p className="muted">일반 회원은 글을 읽을 수 있고 작가는 글을 쓸 수 있습니다. 운영 권한은 별도로 관리합니다.</p>
      <p className="muted">전체 {props.managedUsers.stats.total}명 · 작가 {props.managedUsers.stats.editors}명 · 일반 회원 {props.managedUsers.stats.readers}명 · 관리자 {props.managedUsers.stats.admins}명</p>
      <form method="get" action="/admin-settings/users" className="grid">
        <div className="field"><label htmlFor="user-search">회원 검색</label><input id="user-search" name="q" defaultValue={props.query ?? ''} /></div>
        <div className="field"><label htmlFor="user-role-filter">권한으로 필터링</label><select id="user-role-filter" name="role" defaultValue={props.roleFilter ?? 'all'}>
          <option value="all">전체 회원</option><option value="reader">일반 회원</option><option value="editor">작가</option><option value="admin">관리자</option>
        </select></div>
        <div className="actions"><button type="submit">검색</button></div>
      </form>
      {props.managedUsers.users.length > 0 ? <ul>
        {props.managedUsers.users.map((managedUser) => <li key={managedUser.id} className="provider">
          <h3>{managedUser.username}</h3>
          <p>{managedUser.name} · {managedUser.email}</p>
          <p className="muted">{managedUser.isSuperuser ? '최고 관리자' : managedUser.isStaff ? '운영자' : managedUser.role === 'EDITOR' ? '작가' : '일반 회원'} · {managedUser.isActive ? '활성' : '비활성'} · 글 {managedUser.postCount}개</p>
          {managedUser.canChangeRole && <form method="post" action={`/admin-settings/users/${managedUser.id}/role`}>
            {csrfInput(props.csrfToken)}
            <label htmlFor={`user-role-${managedUser.id}`}>회원 권한</label>{' '}
            <select id={`user-role-${managedUser.id}`} name="role" defaultValue={managedUser.role}>
              <option value="READER">일반 회원</option><option value="EDITOR">작가</option>
            </select>{' '}
            <button type="submit">권한 저장</button>
          </form>}
        </li>)}
      </ul> : <p className="muted">조건에 맞는 회원이 없습니다.</p>}
      <nav aria-label="회원 목록 페이지">
        {props.managedUsers.pagination.hasPrevious && <a href={`/admin-settings/users?q=${encodeURIComponent(props.query ?? '')}&role=${encodeURIComponent(props.roleFilter ?? 'all')}&page=${props.managedUsers.pagination.page - 1}`}>이전 페이지</a>}
        {props.managedUsers.pagination.hasNext && <a href={`/admin-settings/users?q=${encodeURIComponent(props.query ?? '')}&role=${encodeURIComponent(props.roleFilter ?? 'all')}&page=${props.managedUsers.pagination.page + 1}`}>다음 페이지</a>}
      </nav>
    </section>}
    <section className="panel" aria-labelledby="invitation-create-heading">
      <h2 id="invitation-create-heading">작가 초대 만들기</h2>
      <p className="muted">초대 링크는 한 번 사용할 수 있으며, 링크로 가입한 회원에게 작가 권한이 주어집니다.</p>
      <form method="post" action="/admin-settings/users">
        {csrfInput(props.csrfToken)}
        <div className="field"><label htmlFor="invite-note">메모</label><input id="invite-note" name="note" maxLength={120} /></div>
        <div className="actions"><button type="submit">초대 링크 만들기</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading">최근 초대</h2>
      {props.invites.length > 0 ? <ul>
        {props.invites.map((invite) => <li key={invite.id} className="provider">
          <p><a href={invite.signupUrl}>{invite.signupUrl}</a></p>
          {invite.note && <p>{invite.note}</p>}
          <p className="muted">생성자 {invite.createdBy || '알 수 없음'} · {invite.isClaimed ? `${invite.claimedBy || '알 수 없음'} 님이 사용` : invite.isActive ? '미사용' : '비활성'}</p>
          {invite.createdDate && <time className="muted" dateTime={invite.createdDate}>{settingsDate(invite.createdDate)}</time>}
          {!invite.isClaimed && <form method="post" action={`/admin-settings/users/${invite.id}/delete`}>
            {csrfInput(props.csrfToken)}
            <button type="submit">미사용 초대 삭제</button>
          </form>}
        </li>)}
      </ul> : <p className="muted">초대 링크가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

export function renderAdminStaticPages(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  pages: AdminStaticPage[];
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('정적 페이지', props.user, 'static-pages', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="static-pages-heading">
      <h2 id="static-pages-heading">공개 페이지</h2>
      <p><a href="/admin-settings/static-pages/create">정적 페이지 만들기</a></p>
      {props.pages.length > 0 ? <ul>{props.pages.map((page) => <li key={page.id} className="provider">
        <h3><a href={`/admin-settings/static-pages/${page.id}/edit`}>{page.title}</a></h3>
        <p><a href={`/static/${encodeURIComponent(page.slug)}/`}>/static/{page.slug}/</a></p>
        <p className="muted">{page.isPublished ? '공개' : '임시 저장'} · {page.showInFooter ? '푸터에 표시' : '푸터에 숨김'} · 순서 {page.order}</p>
        <form method="post" action={`/admin-settings/static-pages/${page.id}/delete`}>
          {csrfInput(props.csrfToken)}<button type="submit">페이지 삭제</button>
        </form>
      </li>)}</ul> : <p className="muted">정적 페이지가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

export function renderAdminStaticPageEditor(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  page: AdminStaticPage | null;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  const page = props.page;
  const action = page ? `/admin-settings/static-pages/${page.id}/edit` : '/admin-settings/static-pages/create';
  return shell(page ? '정적 페이지 수정' : '정적 페이지 만들기', props.user, 'static-pages', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <p><a href="/admin-settings/static-pages">← 정적 페이지</a></p>
    <section className="panel">
      <form method="post" action={action}>
        {csrfInput(props.csrfToken)}
        <div className="field"><label htmlFor="static-title">제목</label><input id="static-title" name="title" required maxLength={200} defaultValue={page?.title ?? ''} /></div>
        <div className="field"><label htmlFor="static-slug">URL 슬러그</label><input id="static-slug" name="slug" required maxLength={100} defaultValue={page?.slug ?? ''} /></div>
        <div className="field"><label htmlFor="static-meta">검색 결과 설명</label><textarea id="static-meta" name="meta_description" maxLength={160} rows={2} defaultValue={page?.metaDescription ?? ''} /></div>
        <div className="field"><label htmlFor="static-content">페이지 HTML</label><textarea id="static-content" name="content" rows={18} defaultValue={page?.content ?? ''} /></div>
        <p><label><input type="checkbox" name="is_published" value="true" defaultChecked={page?.isPublished ?? true} /> 페이지 공개</label></p>
        <p><label><input type="checkbox" name="show_in_footer" value="true" defaultChecked={page?.showInFooter ?? false} /> 푸터에 표시</label></p>
        <div className="field"><label htmlFor="static-order">표시 순서</label><input id="static-order" type="number" name="order" defaultValue={page?.order ?? 0} /></div>
        <div className="actions"><button type="submit">페이지 저장</button></div>
      </form>
    </section>
  </>, props.csrfToken);
}

export function renderAdminNotices(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  notices: AdminNotice[];
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('전체 공지', props.user, 'notices', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="notice-create-heading">
      <h2 id="notice-create-heading">공지 만들기</h2>
      <form method="post" action="/admin-settings/global-notices">
        {csrfInput(props.csrfToken)}
        <div className="grid">
          <div className="field"><label htmlFor="notice-title">제목</label><input id="notice-title" name="title" required maxLength={200} /></div>
          <div className="field"><label htmlFor="notice-url">이동할 주소</label><input id="notice-url" name="url" required maxLength={255} /></div>
        </div>
        <p><label><input type="checkbox" name="is_active" value="true" defaultChecked /> 공지 표시</label></p>
        <div className="actions"><button type="submit">공지 만들기</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="notices-heading">
      <h2 id="notices-heading">공지사항</h2>
      {props.notices.length > 0 ? <ul>{props.notices.map((notice) => <li key={notice.id} className="provider">
        <form method="post" action={`/admin-settings/global-notices/${notice.id}`}>
          {csrfInput(props.csrfToken)}
          <div className="grid">
            <div className="field"><label htmlFor={`notice-title-${notice.id}`}>제목</label><input id={`notice-title-${notice.id}`} name="title" defaultValue={notice.title} /></div>
            <div className="field"><label htmlFor={`notice-url-${notice.id}`}>이동할 주소</label><input id={`notice-url-${notice.id}`} name="url" defaultValue={notice.url} /></div>
          </div>
          <p><label><input type="checkbox" name="is_active" value="true" defaultChecked={notice.isActive} /> 공지 표시</label></p>
          <button type="submit">공지 저장</button>
        </form>
        <form method="post" action={`/admin-settings/global-notices/${notice.id}/delete`}>
          {csrfInput(props.csrfToken)}<button type="submit">공지 삭제</button>
        </form>
      </li>)}</ul> : <p className="muted">전체 공지가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

export function renderAdminBanners(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  banners: AdminBanner[];
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('전체 배너', props.user, 'banners', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="banner-create-heading">
      <h2 id="banner-create-heading">배너 만들기</h2>
      <form method="post" action="/admin-settings/global-banners">
        {csrfInput(props.csrfToken)}
        <div className="field"><label htmlFor="banner-title">배너 이름</label><input id="banner-title" name="title" required maxLength={200} /></div>
        <div className="field"><label htmlFor="banner-content">배너 HTML</label><textarea id="banner-content" name="content_html" rows={8} required /></div>
        <div className="grid">
          <div className="field"><label htmlFor="banner-type">유형</label><select id="banner-type" name="banner_type"><option value="horizontal">가로형</option><option value="sidebar">사이드바</option></select></div>
          <div className="field"><label htmlFor="banner-position">위치</label><select id="banner-position" name="position"><option value="top">위</option><option value="bottom">아래</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></div>
          <div className="field"><label htmlFor="banner-order">순서</label><input id="banner-order" type="number" name="order" defaultValue={0} /></div>
        </div>
        <p><label><input type="checkbox" name="is_active" value="true" defaultChecked /> 배너 표시</label></p>
        <div className="actions"><button type="submit">배너 만들기</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="banners-heading">
      <h2 id="banners-heading">배너</h2>
      {props.banners.length > 0 ? <ul>{props.banners.map((banner) => <li key={banner.id} className="provider">
        <form method="post" action={`/admin-settings/global-banners/${banner.id}`}>
          {csrfInput(props.csrfToken)}
          <div className="field"><label htmlFor={`banner-title-${banner.id}`}>이름</label><input id={`banner-title-${banner.id}`} name="title" defaultValue={banner.title} /></div>
          <div className="field"><label htmlFor={`banner-content-${banner.id}`}>HTML</label><textarea id={`banner-content-${banner.id}`} name="content_html" rows={7} defaultValue={banner.contentHtml} /></div>
          <div className="grid">
            <div className="field"><label htmlFor={`banner-type-${banner.id}`}>유형</label><select id={`banner-type-${banner.id}`} name="banner_type" defaultValue={banner.bannerType}><option value="horizontal">가로형</option><option value="sidebar">사이드바</option></select></div>
            <div className="field"><label htmlFor={`banner-position-${banner.id}`}>위치</label><select id={`banner-position-${banner.id}`} name="position" defaultValue={banner.position}><option value="top">위</option><option value="bottom">아래</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></div>
            <div className="field"><label htmlFor={`banner-order-${banner.id}`}>순서</label><input id={`banner-order-${banner.id}`} type="number" name="order" defaultValue={banner.order} /></div>
          </div>
          <p><label><input type="checkbox" name="is_active" value="true" defaultChecked={banner.isActive} /> 배너 표시</label></p>
          <button type="submit">배너 저장</button>
        </form>
        <form method="post" action={`/admin-settings/global-banners/${banner.id}/delete`}>
          {csrfInput(props.csrfToken)}<button type="submit">배너 삭제</button>
        </form>
        <p className="muted">생성자 {banner.createdBy ?? '알 수 없음'}</p>
      </li>)}</ul> : <p className="muted">전체 배너가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

function authorSettingsShell(
  title: string,
  user: AdminSettingsUser,
  active: 'author-notices' | 'author-banners',
  content: ReactNode,
  csrfToken: string,
): string {
  return renderSettingsShell({
    mode: 'personal', title,
    currentPath: active === 'author-notices' ? '/settings/notices' : '/settings/banners',
    user: { ...user, hasEditorRole: true }, csrfToken, content,
  });
}

export function renderAuthorNotices(props: {
  user: AdminSettingsUser;
  notices: AdminNotice[];
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return authorSettingsShell('내 공지사항', props.user, 'author-notices', <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="author-notice-create-heading">
      <h2 id="author-notice-create-heading">공지 만들기</h2>
      <form method="post" action="/settings/notices">
        {csrfInput(props.csrfToken)}
        <div className="grid">
          <div className="field"><label htmlFor="author-notice-title">제목</label><input id="author-notice-title" name="title" required maxLength={200} /></div>
          <div className="field"><label htmlFor="author-notice-url">이동할 주소</label><input id="author-notice-url" name="url" required maxLength={255} /></div>
        </div>
        <p><label><input type="checkbox" name="is_active" value="true" defaultChecked /> 공지 표시</label></p>
        <button type="submit">공지 만들기</button>
      </form>
    </section>
    <section className="panel" aria-labelledby="author-notices-heading">
      <h2 id="author-notices-heading">내 공지사항</h2>
      {props.notices.length ? <ul>{props.notices.map((notice) => <li key={notice.id} className="provider">
        <form method="post" action={`/settings/notices/${notice.id}`}>
          {csrfInput(props.csrfToken)}
          <div className="grid">
            <div className="field"><label htmlFor={`author-notice-title-${notice.id}`}>제목</label><input id={`author-notice-title-${notice.id}`} name="title" defaultValue={notice.title} /></div>
            <div className="field"><label htmlFor={`author-notice-url-${notice.id}`}>이동할 주소</label><input id={`author-notice-url-${notice.id}`} name="url" defaultValue={notice.url} /></div>
          </div>
          <p><label><input type="checkbox" name="is_active" value="true" defaultChecked={notice.isActive} /> 공지 표시</label></p>
          <button type="submit">공지 저장</button>
        </form>
        <form method="post" action={`/settings/notices/${notice.id}/delete`}>
          {csrfInput(props.csrfToken)}<button type="submit">공지 삭제</button>
        </form>
      </li>)}</ul> : <p className="muted">등록한 공지가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

export function renderAuthorBanners(props: {
  user: AdminSettingsUser;
  banners: AdminBanner[];
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return authorSettingsShell('내 배너', props.user, 'author-banners', <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="author-banner-create-heading">
      <h2 id="author-banner-create-heading">배너 만들기</h2>
      <form method="post" action="/settings/banners">
        {csrfInput(props.csrfToken)}
        <div className="field"><label htmlFor="author-banner-title">배너 이름</label><input id="author-banner-title" name="title" required maxLength={200} /></div>
        <div className="field"><label htmlFor="author-banner-content">배너 HTML</label><textarea id="author-banner-content" name="content_html" rows={8} required /></div>
        <div className="grid">
          <div className="field"><label htmlFor="author-banner-type">유형</label><select id="author-banner-type" name="banner_type"><option value="horizontal">가로형</option><option value="sidebar">사이드바</option></select></div>
          <div className="field"><label htmlFor="author-banner-position">위치</label><select id="author-banner-position" name="position"><option value="top">위</option><option value="bottom">아래</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></div>
          <div className="field"><label htmlFor="author-banner-order">순서</label><input id="author-banner-order" type="number" name="order" defaultValue={0} /></div>
        </div>
        <p><label><input type="checkbox" name="is_active" value="true" defaultChecked /> 배너 표시</label></p>
        <button type="submit">배너 만들기</button>
      </form>
    </section>
    <section className="panel" aria-labelledby="author-banner-order-heading">
      <h2 id="author-banner-order-heading">배너 순서</h2>
      {props.banners.length ? <form method="post" action="/settings/banners/order">
        {csrfInput(props.csrfToken)}
        <ol>{props.banners.map((banner) => <li key={banner.id}>
          <label htmlFor={`author-banner-order-${banner.id}`}>{banner.title}</label>
          <input id={`author-banner-order-${banner.id}`} type="number" name={`order_${banner.id}`} defaultValue={banner.order} />
        </li>)}</ol>
        <button type="submit">배너 순서 저장</button>
      </form> : <p className="muted">배너를 만들면 표시 순서를 설정할 수 있습니다.</p>}
    </section>
    <section className="panel" aria-labelledby="author-banners-heading">
      <h2 id="author-banners-heading">내 배너</h2>
      {props.banners.length ? <ul>{props.banners.map((banner) => <li key={banner.id} className="provider">
        <form method="post" action={`/settings/banners/${banner.id}`}>
          {csrfInput(props.csrfToken)}
          <div className="field"><label htmlFor={`author-banner-title-${banner.id}`}>이름</label><input id={`author-banner-title-${banner.id}`} name="title" defaultValue={banner.title} /></div>
          <div className="field"><label htmlFor={`author-banner-content-${banner.id}`}>HTML</label><textarea id={`author-banner-content-${banner.id}`} name="content_html" rows={7} defaultValue={banner.contentHtml} /></div>
          <div className="grid">
            <div className="field"><label htmlFor={`author-banner-type-${banner.id}`}>유형</label><select id={`author-banner-type-${banner.id}`} name="banner_type" defaultValue={banner.bannerType}><option value="horizontal">가로형</option><option value="sidebar">사이드바</option></select></div>
            <div className="field"><label htmlFor={`author-banner-position-${banner.id}`}>위치</label><select id={`author-banner-position-${banner.id}`} name="position" defaultValue={banner.position}><option value="top">위</option><option value="bottom">아래</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></div>
            <div className="field"><label htmlFor={`author-banner-order-edit-${banner.id}`}>순서</label><input id={`author-banner-order-edit-${banner.id}`} type="number" name="order" defaultValue={banner.order} /></div>
          </div>
          <p><label><input type="checkbox" name="is_active" value="true" defaultChecked={banner.isActive} /> 배너 표시</label></p>
          <button type="submit">배너 저장</button>
        </form>
        <form method="post" action={`/settings/banners/${banner.id}/delete`}>
          {csrfInput(props.csrfToken)}<button type="submit">배너 삭제</button>
        </form>
      </li>)}</ul> : <p className="muted">등록한 배너가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

export type AdminUtilityAction = 'clean_tags' | 'clean_sessions' | 'clean_logs' | 'clean_images';
type AdminImageCleanupTarget = 'all' | 'content' | 'title' | 'avatar';

function UtilityCounts({ action, data }: { action: Exclude<AdminUtilityAction, 'clean_images'>; data: Record<string, unknown> }) {
  const counts = {
    clean_tags: [['전체 태그', 'totalTags'], ['사용 중인 태그', 'usedTags'], ['미사용 태그', 'unusedTags'], ['정리 대상 태그', 'cleanedCount']],
    clean_sessions: [['전체 세션', 'totalSessions'], ['만료된 세션', 'expiredSessions'], ['정리한 세션', 'cleanedCount']],
    clean_logs: [['전체 관리 로그', 'logCount'], ['만료된 관리 로그', 'expiredLogCount'], ['정리한 관리 로그', 'cleanedCount'],
      ['전체 개발자 API 로그', 'developerRequestLogCount'], ['만료된 개발자 API 로그', 'expiredDeveloperRequestLogCount'],
      ['정리한 개발자 API 로그', 'cleanedDeveloperRequestLogCount']],
  }[action];
  return <>
    <dl className="grid">{counts.map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{String(data[key] ?? 0)}</dd></div>)}</dl>
    {action === 'clean_tags' && Array.isArray(data.cleanedTags) && data.cleanedTags.length > 0 && <ul>{data.cleanedTags.map((tag, index) =>
      <li key={index}>{String(tag)}</li>)}</ul>}
  </>;
}

function imageCleanupMessage(message: string): string {
  if (message.startsWith('Skipped a changed file: ')) return `변경된 파일 건너뜀 · ${message.slice('Skipped a changed file: '.length)}`;
  if (message.startsWith('Could not delete: ')) return `삭제 실패 · ${message.slice('Could not delete: '.length)}`;
  if (message.startsWith('Deleted unused image files: ')) return `미사용 이미지 ${message.match(/\d+/)?.[0] ?? 0}개를 삭제했습니다.`;
  if (message.startsWith('Deleted image caches: ')) return `이미지 캐시 ${message.match(/\d+/)?.[0] ?? 0}개를 삭제했습니다.`;
  return settingsErrorMessage(message);
}

export function renderAdminUtilities(props: {
  user: AdminSettingsUser;
  capabilities: AdminCapabilities;
  stats: Record<string, unknown>;
  csrfToken: string;
  feedback?: {
    action: AdminUtilityAction;
    data: Record<string, unknown>;
    confirmationToken?: string;
    cleanAll?: boolean;
  };
  saved?: boolean;
  error?: string;
}): string {
  const feedback = props.feedback;
  const executeForm = feedback?.confirmationToken ? <form method="post" action="/admin-settings/utilities">
    {csrfInput(props.csrfToken)}
    <input type="hidden" name="action" value={feedback.action} />
    <input type="hidden" name="dry_run" value="false" />
    <input type="hidden" name="confirmation_token" value={feedback.confirmationToken} />
    {feedback.action === 'clean_sessions' && feedback.cleanAll && <input type="hidden" name="clean_all" value="true" />}
    {feedback.action === 'clean_images' && <>
      <input type="hidden" name="target" value={String(feedback.data.target ?? 'all')} />
      <input type="hidden" name="remove_duplicates" value={feedback.data.removeDuplicates === true ? 'true' : 'false'} />
      <input type="hidden" name="preview_hash" value={String(feedback.data.previewHash ?? '')} />
    </>}
    <p className="muted">정리 확인은 현재 세션에서 5분 동안 유효합니다.</p>
    <button type="submit">확인하고 실행</button>
  </form> : null;
  const previewForm = (action: AdminUtilityAction, label: string, options?: { cleanAll?: boolean; target?: AdminImageCleanupTarget; removeDuplicates?: boolean }) => <form method="post" action="/admin-settings/utilities">
    {csrfInput(props.csrfToken)}
    <input type="hidden" name="action" value={action} />
    <input type="hidden" name="dry_run" value="true" />
    {options?.cleanAll && <input type="hidden" name="clean_all" value="true" />}
    {action === 'clean_images' && <>
      <input type="hidden" name="target" value={options?.target ?? 'all'} />
      <input type="hidden" name="remove_duplicates" value={options?.removeDuplicates === true ? 'true' : 'false'} />
    </>}
    <button type="submit">{label}</button>
  </form>;
  const statLabels: Array<[string, string]> = [
    ['totalPosts', '전체 글'], ['publicPosts', '공개 글'], ['publishedPosts', '발행 글'],
    ['scheduledPosts', '예약 글'], ['draftPosts', '임시 글'], ['totalComments', '댓글'],
    ['totalUsers', '회원'], ['activeProfiles', '프로필'], ['totalSeries', '시리즈'],
    ['imageCacheCount', '이미지 캐시'], ['totalSessions', '세션'], ['expiredSessions', '만료된 세션'],
    ['logCount', '관리 로그'], ['developerRequestLogCount', '개발자 API 로그'], ['dbSize', 'DB 크기'],
  ];
  return shell('시스템 도구', props.user, 'utilities', props.capabilities, <>
    {statusNotice(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="stats-heading">
      <h2 id="stats-heading">데이터베이스 현황</h2>
      <dl className="grid">{statLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(props.stats[key] ?? 0)}</dd></div>)}</dl>
    </section>
    <section className="panel" aria-labelledby="tags-cleanup-heading">
      <h2 id="tags-cleanup-heading">미사용 태그</h2>
      <p className="muted">어떤 글에도 사용되지 않은 태그를 미리 확인하고 삭제할 수 있습니다.</p>
      {previewForm('clean_tags', '미사용 태그 미리보기')}
    </section>
    <section className="panel" aria-labelledby="sessions-cleanup-heading">
      <h2 id="sessions-cleanup-heading">만료된 세션</h2>
      <p className="muted">만료된 세션을 정리합니다. 전체 세션을 정리하면 모든 회원이 로그아웃됩니다.</p>
      {previewForm('clean_sessions', '만료된 세션 정리 미리보기')}
      {previewForm('clean_sessions', '전체 세션 정리 미리보기', { cleanAll: true })}
    </section>
    <section className="panel" aria-labelledby="logs-cleanup-heading">
      <h2 id="logs-cleanup-heading">보존 기간이 지난 로그</h2>
      <p className="muted">관리 로그와 개발자 API 로그의 보존 기간을 기준으로 정리합니다.</p>
      {previewForm('clean_logs', '로그 정리 미리보기')}
    </section>
    <section className="panel" aria-labelledby="images-cleanup-heading">
      <h2 id="images-cleanup-heading">사용되지 않는 이미지</h2>
      <p className="muted">글, 휴지통, 수정 기록, 댓글, 프로필, 시리즈, 정적 페이지, 글 양식과 이미지 캐시를 확인합니다. 본문·커버·프로필 이미지 폴더에서 어디에도 사용되지 않은 파일이 정리 대상이며, 목록은 5분 동안 유효합니다.</p>
      <form method="post" action="/admin-settings/utilities">
        {csrfInput(props.csrfToken)}<input type="hidden" name="action" value="clean_images" /><input type="hidden" name="dry_run" value="true" />
        <div className="field"><label htmlFor="image-clean-target">이미지 폴더</label><select id="image-clean-target" name="target"><option value="all">모든 이미지 폴더</option><option value="content">본문 이미지</option><option value="title">커버 이미지</option><option value="avatar">프로필 이미지와 커버</option></select></div>
        <p><label><input type="checkbox" name="remove_duplicates" value="true" /> 사용되지 않는 동일 커버 이미지도 정리</label></p>
        <button type="submit">이미지 정리 미리보기</button>
      </form>
    </section>
    {feedback && <section className="panel" aria-labelledby="utility-result-heading">
      <h2 id="utility-result-heading">{feedback.confirmationToken ? '정리 미리보기' : '정리 결과'}</h2>
      {feedback.action === 'clean_images' ? <>
        <p>이미지 {String(feedback.data.totalUnused ?? feedback.data.cleanedCount ?? 0)}개 · {String(feedback.data.totalSizeMb ?? 0)} MB</p>
        {feedback.data.dryRun === true && <ul>{(Array.isArray(feedback.data.unusedFiles) ? feedback.data.unusedFiles : []).map((rawFile, index) => {
          const file = rawFile && typeof rawFile === 'object' ? rawFile as Record<string, unknown> : {};
          return <li key={`${String(file.path ?? '')}-${index}`}><a href={String(file.url ?? '#')}>{String(file.path ?? '이미지 파일')}</a> · {String(file.sizeKb ?? 0)} KB</li>;
        })}</ul>}
        {Array.isArray(feedback.data.duplicateFiles) && <ul>{feedback.data.duplicateFiles.map((rawFile, index) => {
          const file = rawFile && typeof rawFile === 'object' ? rawFile as Record<string, unknown> : {};
          return <li key={`${String(file.duplicateUrl ?? '')}-${index}`}>중복 파일 <a href={String(file.duplicateUrl ?? '#')}>{String(file.duplicateUrl ?? '')}</a> · 원본 <a href={String(file.originalUrl ?? '#')}>{String(file.originalUrl ?? '')}</a></li>;
        })}</ul>}
        {feedback.data.hasErrors === true && <p role="alert">일부 파일을 건너뛰었습니다. 정리 결과를 확인해 주세요.</p>}
        {Array.isArray(feedback.data.messages) && <ul>{feedback.data.messages.map((message, index) => <li key={index}>{imageCleanupMessage(String(message))}</li>)}</ul>}
      </> : <UtilityCounts action={feedback.action} data={feedback.data} />}
      {executeForm}
    </section>}
  </>, props.csrfToken);
}
