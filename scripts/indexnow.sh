#!/usr/bin/env bash
# Tells Bing, Yandex, Seznam and Naver (via IndexNow) that this site's pages changed, so they
# re-crawl within minutes instead of weeks. Google does not use IndexNow; it reads the sitemap.
# Usage: bash scripts/indexnow.sh            (submits every URL in the live sitemap)
#        bash scripts/indexnow.sh URL [URL]  (submits just those)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${HOST:-$(cat "$ROOT/docs/CNAME" 2>/dev/null || cat "$ROOT/public/CNAME")}"
KEYFILE="$(find "$ROOT/docs" "$ROOT/public" -maxdepth 1 -name '*.txt' 2>/dev/null | grep -E '/[0-9a-f]{32}\.txt$' | head -1 || true)"
[ -n "$KEYFILE" ] || { echo "No IndexNow key file found in docs/ or public/."; exit 1; }
KEY="$(basename "$KEYFILE" .txt)"
if [ $# -gt 0 ]; then URLS=("$@"); else
  SM="https://$HOST/sitemap.xml"; curl -fsS -o /dev/null "$SM" 2>/dev/null || SM="https://$HOST/sitemap-0.xml"
  URLS=(); while IFS= read -r u; do URLS+=("$u"); done < <(curl -fsS "$SM" | grep -o '<loc>[^<]*' | sed 's/<loc>//')
fi
[ "$(curl -fsS "https://$HOST/$KEY.txt" | tr -d '[:space:]')" = "$KEY" ] || { echo "Key file is not live at https://$HOST/$KEY.txt yet. Push first, then retry."; exit 1; }
BODY=$(printf '%s\n' "${URLS[@]}" | python3 -c 'import sys,json; print(json.dumps({"host":sys.argv[1],"key":sys.argv[2],"keyLocation":"https://%s/%s.txt"%(sys.argv[1],sys.argv[2]),"urlList":[l.strip() for l in sys.stdin if l.strip()]}))' "$HOST" "$KEY")
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST 'https://api.indexnow.org/indexnow' -H 'Content-Type: application/json; charset=utf-8' --data "$BODY")
echo "IndexNow: submitted ${#URLS[@]} URLs for $HOST (HTTP $CODE; 200 or 202 means accepted)"
