### 패키지 업그레이드

```bash
pip install $(pip list --outdated --format=columns |tail -n +3|cut -d" " -f1) --upgrade
```