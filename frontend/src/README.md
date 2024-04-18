### 패키지 업데이트

```bash
npx pnpm update --save && npx pnpm update --save
```

### 패키지 업그레이드

```bash
npx pnpm upgrade --latest --save
```

```bash
npx pnpm i --save $(npm outdate | tail -n +2 | grep '^[^ ]*' | awk '{print $1 "@" $4}')
```