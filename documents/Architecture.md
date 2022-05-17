## FRONTEND

- Next의 기본 규칙에 따라 `pages`안에 디렉터리 및 파일은 각각의 URL 주소와 일치합니다. 프론트엔드를 수정하려는 경우 이 디렉터리 안에서 해당 경로의 파일을 탐색한 후 페이지 안에 포함된 각각의 컴포넌트를 수정할 수 있습니다.
- 컴포넌트는 클래스형과 함수형이 혼합되어 있으나 클래스형에서 함수형으로 전환하는 과정에서 남아있는 것입니다. 새롭게 개발하는 모든 컴포넌트는 타입스크립트 기반의 함수형으로 선언합니다.

  - 일반적인 컴포넌트
  ```typescript
  export default function Component(props: Props) {
      return;
  }
  ```

  - 레이아웃이 포함된 컴포넌트
  ```typescript
  const Component: PageComponent<Props> = (props) => {
      return (
          <></>
      );
  }

  Component.pageLayout = (page, props) => {
      return (
          <Layout>
              {page}
          </Layout>
      );
  }

  export default Component;
  ```
- 스타일링은 CSS 모듈(with SCSS)을 사용하고 있습니다. 필요하다면 다크모드를 지원해야 합니다. 다크모드는 body에 dark class의 존재 여부로 판단할 수 있습니다.

  ```scss
  :global(body.dark) & {
      // dark mode style...
  }
  ```

<br>

## BACKEND

- Djagno의 기본 규칙에 따라 `urls.py`안에 각 URL과 URL에 어떤 모듈이 매핑되어 있는지 나열되어 있습니다. 기본적인 백엔드의 URL 구조를 살펴보려면 이 파일을 열어보십시오.
- 모듈은 각각의 디렉터리에 분포되어 있습니다. 최상의 디렉터리의 모듈은 장고에 의존적이지 않으며 하위 디렉터리 안에 존재하는 모듈은 장고 혹은 모델에 의존적인 모듈입니다.
- API는 버저닝하지 않는 것을 지향하지만 현재 아름다운 API 구조를 찾아가는 과정에 있으므로 버저닝하여 관리하고 있습니다. 같은 버전의 API는 응답을 유사하게 내려주며 특히 오류에 대한 응답을 통일해야 합니다.