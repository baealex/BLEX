import { createElement, type ReactNode } from 'react';
import { renderSettingsShell } from '../settings-shell.js';

export interface PersonalSettingsUser {
  id: number;
  username: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
  hasConnectedTelegram?: boolean;
  canUseTelegramIntegration?: boolean;
}

export interface RegionalPreferences {
  language: string | null;
  timeZone: string;
  defaultLanguage: string;
  defaultTimeZone: string;
  languages: Array<{ code: string; label: string }>;
  timeZones: string[];
}

export interface AccountSettingsView {
  username: string;
  name: string;
  email: string;
  createdDate: string;
  regionalPreferences: RegionalPreferences;
}

export interface ProfileSettingsView {
  avatar: string;
  cover: string | null;
  bio: string;
  homepage: string;
  social: Array<{ id: number; name: string; value: string; order: number }>;
}

type PersonalSettingsPage = 'account' | 'profile' | 'social-links' | 'about';

const h = createElement;

function shell(title: string, user: PersonalSettingsUser, page: PersonalSettingsPage, content: ReactNode, csrfToken: string): string {
  const currentPaths: Record<PersonalSettingsPage, string> = {
    account: '/settings/account',
    profile: '/settings/profile',
    'social-links': '/settings/social-links',
    about: `/@${encodeURIComponent(user.username)}/about/edit`,
  };
  return renderSettingsShell({
    mode: 'personal', title, currentPath: currentPaths[page], user, csrfToken, content,
    canUseTelegramIntegration: user.canUseTelegramIntegration ?? user.hasConnectedTelegram ?? false,
  });
}

function hiddenCsrf(csrfToken: string) {
  return h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: csrfToken });
}

function statusMessage(saved: boolean, error?: string) {
  if (error) return h('p', { className: 'status error', role: 'alert' }, error);
  if (saved) return h('p', { className: 'status success', role: 'status' }, '변경 사항을 저장했습니다.');
  return null;
}

export function renderAccountSettings(props: {
  user: PersonalSettingsUser;
  account: AccountSettingsView;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  const preferences = props.account.regionalPreferences;
  const selectedLanguage = preferences.language === null ? 'browser' : preferences.language;
  const defaultLanguageLabel = preferences.languages.find(({ code }) => code === preferences.defaultLanguage)?.label ?? preferences.defaultLanguage;
  return shell('계정', props.user, 'account', <>
    {statusMessage(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="account-info-heading">
      <h2 id="account-info-heading">계정 정보</h2>
      <div className="grid">
        <div><strong>아이디</strong><p className="value">{props.account.username}</p></div>
        <div><strong>이메일</strong><p className="value">{props.account.email}</p></div>
        <div><strong>가입일</strong><p className="value">{props.account.createdDate}</p></div>
      </div>
    </section>
    <section className="panel" aria-labelledby="username-heading">
      <h2 id="username-heading">아이디 변경</h2>
      <form method="post" action="/settings/account">
        {hiddenCsrf(props.csrfToken)}
        <input type="hidden" name="intent" value="username" />
        <div className="field"><label htmlFor="settings-username">새 아이디</label>
          <input id="settings-username" name="username" pattern="[a-z0-9]{4,15}" required maxLength={15} autoComplete="off" />
        </div>
        <div className="actions"><button type="submit">아이디 변경</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="name-heading">
      <h2 id="name-heading">표시 이름</h2>
      <form method="post" action="/settings/account">
        {hiddenCsrf(props.csrfToken)}
        <input type="hidden" name="intent" value="name" />
        <div className="field"><label htmlFor="settings-name">이름</label><input id="settings-name" name="name" maxLength={30} defaultValue={props.account.name} /></div>
        <div className="actions"><button type="submit">이름 저장</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="regional-heading">
      <h2 id="regional-heading">언어와 시간대</h2>
      <form method="post" action="/settings/account">
        {hiddenCsrf(props.csrfToken)}
        <input type="hidden" name="intent" value="regional" />
        <div className="field">
          <label htmlFor="settings-language">언어</label>
          <select id="settings-language" name="language" defaultValue={selectedLanguage}>
            <option value="browser">브라우저 언어</option>
            <option value="">사이트 기본값 ({defaultLanguageLabel})</option>
            {preferences.languages.map(({ code, label }) => h('option', { key: code, value: code }, label))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="settings-time-zone">시간대</label>
          <select id="settings-time-zone" name="time_zone" defaultValue={preferences.timeZone}>
            <option value="">사이트 기본값 ({preferences.defaultTimeZone})</option>
            {preferences.timeZones.map((zone) => h('option', { key: zone, value: zone }, zone.replace(/_/g, ' ')))}
          </select>
        </div>
        <div className="actions"><button type="submit">환경 설정 저장</button></div>
      </form>
    </section>
  </>, props.csrfToken);
}

export function renderProfileSettings(props: {
  user: PersonalSettingsUser;
  profile: ProfileSettingsView;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('프로필', props.user, 'profile', <>
    {statusMessage(props.saved ?? false, props.error)}
    <section className="panel" aria-labelledby="profile-images-heading">
      <h2 id="profile-images-heading">프로필 이미지</h2>
      <div className="grid">
        <div>
          <h3>프로필 사진</h3>
          <img className="profile-image" src={props.profile.avatar} alt="현재 프로필 사진" />
          <form method="post" action="/v1/setting/avatar" encType="multipart/form-data">
            {hiddenCsrf(props.csrfToken)}
            <input type="hidden" name="return_to" value="/settings/profile?saved=avatar" />
            <div className="field"><label htmlFor="profile-avatar-upload">이미지 선택</label><input id="profile-avatar-upload" type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif" required /></div>
            <button type="submit">프로필 사진 저장</button>
          </form>
        </div>
        <div>
          <h3>커버</h3>
          {props.profile.cover ? <img className="profile-image" src={props.profile.cover} alt="현재 커버" /> : <p className="muted">등록된 커버 이미지가 없습니다.</p>}
          <form method="post" action="/v1/setting/cover" encType="multipart/form-data">
            {hiddenCsrf(props.csrfToken)}
            <input type="hidden" name="return_to" value="/settings/profile?saved=cover" />
            <div className="field"><label htmlFor="profile-cover-upload">이미지 선택</label><input id="profile-cover-upload" type="file" name="cover" accept="image/jpeg,image/png,image/webp,image/gif" required /></div>
            <button type="submit">커버 저장</button>
          </form>
          {props.profile.cover && <form method="post" action="/settings/profile/cover/delete">
            {hiddenCsrf(props.csrfToken)}
            <button type="submit">커버 삭제</button>
          </form>}
        </div>
      </div>
    </section>
    <section className="panel">
      <h2>공개 프로필 정보</h2>
      <p className="muted">소개와 홈페이지 주소는 공개 프로필에 표시됩니다.</p>
      {props.user.hasEditorRole && <p><a href={`/@${props.user.username}/about/edit`}>작가 소개 편집</a></p>}
      <form method="post" action="/settings/profile">
        {hiddenCsrf(props.csrfToken)}
        <div className="field"><label htmlFor="profile-bio">소개</label><textarea id="profile-bio" name="bio" maxLength={500} rows={5} defaultValue={props.profile.bio} /></div>
        <div className="field"><label htmlFor="profile-homepage">홈페이지</label><input id="profile-homepage" name="homepage" type="url" defaultValue={props.profile.homepage} placeholder="https://example.com" /></div>
        <div className="actions"><button type="submit">프로필 저장</button></div>
      </form>
    </section>
  </>, props.csrfToken);
}

export function renderAboutSettings(props: {
  user: PersonalSettingsUser;
  authorUsername: string;
  csrfToken: string;
  markdown: string;
  previewHtml: string;
  saved?: boolean;
  error?: string;
}): string {
  const action = `/@${encodeURIComponent(props.authorUsername)}/about/edit`;
  return shell('작성자 소개 편집', props.user, 'about', <>
    {statusMessage(props.saved ?? false, props.error)}
    <p className="muted">작가 프로필에 공개할 소개를 마크다운으로 작성합니다.</p>
    <section className="panel" aria-labelledby="about-editor-heading">
      <h2 id="about-editor-heading">소개 내용</h2>
      <form method="post" action={action}>
        {hiddenCsrf(props.csrfToken)}
        <input type="hidden" name="return_to" value="1" />
        <div className="field">
          <label htmlFor="author-about-markdown">마크다운 소개</label>
          <textarea id="author-about-markdown" name="about_md" rows={18} maxLength={262144} spellCheck={false} defaultValue={props.markdown} />
        </div>
        <div className="actions"><button type="submit">소개 저장</button></div>
      </form>
    </section>
    <section className="panel" aria-labelledby="about-preview-heading">
      <h2 id="about-preview-heading">현재 공개 미리보기</h2>
      {props.previewHtml
        ? <div className="about-preview" dangerouslySetInnerHTML={{ __html: props.previewHtml }} />
        : <p className="muted">아직 등록된 소개가 없습니다.</p>}
    </section>
  </>, props.csrfToken);
}

const platforms = [
  ['github', 'GitHub'], ['twitter', 'X'], ['threads', 'Threads'], ['facebook', 'Facebook'],
  ['telegram', '텔레그램'], ['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['other', '기타'],
] as const;

function platformOptions(selected: string) {
  const options: Array<readonly [string, string]> = [['', '서비스 선택'], ...platforms];
  if (selected && !options.some(([value]) => value === selected)) options.push([selected, selected]);
  return options.map(([value, label]) => h('option', { key: value, value, ...(value === '' ? { disabled: true } : {}) }, label));
}

export function renderSocialLinkSettings(props: {
  user: PersonalSettingsUser;
  profile: ProfileSettingsView;
  csrfToken: string;
  saved?: boolean;
  error?: string;
}): string {
  return shell('소셜 링크', props.user, 'social-links', <>
    {statusMessage(props.saved ?? false, props.error)}
    <p className="muted">HTTPS 주소를 입력하세요. 프로필에는 주소가 안전한 링크인 경우에만 표시됩니다.</p>
    <section className="panel" aria-labelledby="existing-social-heading">
      <h2 id="existing-social-heading">등록된 링크</h2>
      {props.profile.social.length === 0 ? <p className="muted">등록된 소셜 링크가 없습니다.</p> : props.profile.social.map((link) => <div className="social-row" key={link.id}>
        <form method="post" action="/settings/social-links">
          {hiddenCsrf(props.csrfToken)}
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="id" value={link.id} />
          <div className="social-actions">
            <div className="field"><label htmlFor={`social-platform-${link.id}`}>서비스</label><select id={`social-platform-${link.id}`} name="name" defaultValue={link.name} required>{platformOptions(link.name)}</select></div>
            <div className="field"><label htmlFor={`social-value-${link.id}`}>주소</label><input id={`social-value-${link.id}`} name="value" type="url" defaultValue={link.value} required /></div>
            <div className="field"><label htmlFor={`social-order-${link.id}`}>표시 순서</label><input id={`social-order-${link.id}`} name="order" type="number" min="0" step="1" defaultValue={link.order} required /></div>
            <button type="submit">저장</button>
          </div>
        </form>
        <form method="post" action="/settings/social-links" className="inline">
          {hiddenCsrf(props.csrfToken)}
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={link.id} />
          <button type="submit" aria-label={`${link.name} 링크 삭제`}>삭제</button>
        </form>
      </div>)}
    </section>
    <section className="panel" aria-labelledby="add-social-heading">
      <h2 id="add-social-heading">링크 추가</h2>
      <form method="post" action="/settings/social-links">
        {hiddenCsrf(props.csrfToken)}
        <input type="hidden" name="intent" value="create" />
        <div className="social-actions">
          <div className="field"><label htmlFor="social-new-platform">서비스</label><select id="social-new-platform" name="name" required defaultValue="">{platformOptions('')}</select></div>
          <div className="field"><label htmlFor="social-new-value">주소</label><input id="social-new-value" name="value" type="url" placeholder="https://example.com" required /></div>
          <div className="field"><label htmlFor="social-new-order">표시 순서</label><input id="social-new-order" name="order" type="number" min="0" step="1" defaultValue={props.profile.social.length + 1} required /></div>
          <button type="submit">링크 추가</button>
        </div>
      </form>
    </section>
  </>, props.csrfToken);
}
