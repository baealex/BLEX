import { renderApplicationDocument } from '~/application/document';
import { publicPostPath } from '~/features/posts/paths';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ source, username, slug, items }: PageProps['@{$username}/{$slug}/related']): string {
  return renderApplicationDocument(<html lang="ko"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,follow" /><title>관련 글 · {source.title}</title>
      <style>{'body{margin:3rem auto;max-width:44rem;padding:0 1rem;font:1rem/1.65 system-ui}li{margin:1rem 0}'}</style>
  </head><body><main><a href={publicPostPath(username, slug)}>글로 돌아가기</a><h1>관련 글</h1>
      {items.length ? <ul>{items.map((item) => <li key={item.slug}>
          <a href={publicPostPath(item.username, item.slug)}>{item.title}</a><p>{item.description}</p>
      </li>)}</ul> : <p>공통 태그가 붙은 글이 없습니다.</p>}
  </main></body></html>);
}
