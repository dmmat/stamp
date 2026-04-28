---
description: Запустити локальний сервер на порту 8765 і відкрити застосунок у браузері за замовчуванням
---

Запусти статичний сервер у фоні, дочекайся готовності та відкрий стартову сторінку.

```bash
cd /home/dmat/projects/stamp
python3 -m http.server 8765 >/tmp/stamp-server.log 2>&1 &
sleep 1
xdg-open http://localhost:8765/ 2>/dev/null || echo "Відкрий вручну: http://localhost:8765/"
echo "Сервер PID: $(pgrep -f 'http.server 8765')"
echo "Зупинити: pkill -f 'http.server 8765'"
```
