

<p align="center">
    <a href="https://github.com/baealex/BLEX">
        <img alt="blex color logo" src="https://user-images.githubusercontent.com/35596687/76856570-de2b8a80-6896-11ea-8827-fc2f1966fa23.png">
    </a>
</p>

<p align="center">
    <strong>BLOG EXPRESS ME</strong>
</p>

<p align="center">
    <img src="https://img.shields.io/badge/nextjs-14-yellow?style=flat-square">
    <img src="https://img.shields.io/badge/django-5-blue?style=flat-square">
</p>

<br>

***"예쁘고 유니크한 블로그 없을까요?"*** 🙋‍♂️ [여기 있습니다!](https://blex.me) 블렉스는 미니멀하고 아름다운 디자인을 지향합니다. 폐쇠형 서비스로 변경되어, 다른 에디터로부터 초대장을 받아야 사용할 수 있습니다. 의견은 [im@baejino.com](mailto:im@baejino.com)으로 보내주세요. 언제나 환영입니다.

![blex](https://user-images.githubusercontent.com/35596687/144164653-d4ed4668-f872-4600-938d-a824bd4b8599.jpg)

<br>

## 기능 소개

- [x] 깃허브와 구글 계정으로 가입해보세요 ✨
- [x] 비슷한 관심사를 가진 에디터에게 초대를 요청해보세요 🤩
- [x] 마크다운으로 글 또는 댓글을 작성해보세요 ✍️
- [x] 텔레그램을 연동하여 실시간으로 알림을 받아보세요 🚀
- [x] 텔레그램 2차 인증으로 내 계정이 안전하게 보호됩니다 🔒
- [x] Open AI를 연동하여 간편하게 설명을 작성하세요 🦾
- [x] 사람들이 내 글을 얼마나, 어떻게, 어디서 발견하는지 확인하세요 📈
- [x] 내 블로그 활동이 깃허브 잔디처럼 정리됩니다 🌿

<br>

## 개발환경 구축

`docker`, `docker-compose`, `nodejs` 가 필요합니다.

```bash
npm i
npm run dev -- -d --build
```

로컬에서만 동작하는 별도의 도메인 매핑을 권장합니다.

```bash
vi /etc/hosts
```

```bash
127.0.0.1       blex.test
```

`blex.test:3000`으로 접속한 후, 기본 계정인 `admin/admin`으로 로그인하여 테스트 할 수 있습니다.

<br>

## 관련 문서

#### 사용자용

- [블렉스 소개 페이지](https://about.blex.me)
- [블렉스 업데이트 내역 (개발노트)](https://blex.me/@baealex/series/%EB%B8%94%EB%A0%89%EC%8A%A4-%EC%9D%B4%EC%95%BC%EA%B8%B0)

#### 개발자용

- [사용하는 기술들](documents/Tech-Stack.md)
- [소스코드 아키택쳐 구조](documents/Architecture.md)
- [아키택쳐 의사결정 기록](documents/Architecture-Decision-Records.md)

<br>

## 라이센스

This is released under the MIT license. See [LICENSE](LICENSE) for details.
