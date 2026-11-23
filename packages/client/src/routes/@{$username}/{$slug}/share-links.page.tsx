import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';

const labelLimit = 100;

export default function renderPage({
 title, postPath, error, create, action, csrf, links
}: PageProps['@{$username}/{$slug}/share-links']): string {
  return renderApplicationDocument(<html lang="ko"><head>
      <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" /><title>공유 링크 · {title}</title>
      <style>{'body{margin:3rem auto;max-width:43rem;padding:0 1rem;font:1rem/1.6 system-ui}li{margin:1.25rem 0}a{overflow-wrap:anywhere}input,button{font:inherit;margin:.25rem}'}</style>
  </head><body><main>
      <a href={postPath}>글로 돌아가기</a><h1>공유 링크</h1><p>{title}</p>
      {error && <p role="alert">{error}</p>}
      {create && <form method="post" action={action}>
          <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
          <label>링크 이름 <input name="label" maxLength={labelLimit} required /></label>
          <button type="submit">링크 만들기</button>
      </form>}
      {links.length > 0 && <ul>{links.map((link) => <li key={link.id}>
          <a href={link.url}>{link.url}</a>
          <p>최근 7일 {link.recentClicks}회 · 전체 {link.totalClicks}회</p>
          <form method="post" action={action}>
              <input type="hidden" name="csrfmiddlewaretoken" value={csrf} /><input type="hidden" name="id" value={link.id} />
              <label>링크 이름 <input name="label" maxLength={labelLimit} defaultValue={link.label} required /></label>
              <label><input name="isPaused" type="checkbox" value="true" defaultChecked={link.isPaused} /> 일시 정지</label>
              <button type="submit">저장</button>
          </form>
      </li>)}</ul>}
  </main></body></html>);
}
