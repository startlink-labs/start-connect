#!/usr/bin/env bash
#
# ContentVersionのバイナリ本体をSalesforce REST APIから一括ダウンロードする。
#
# 前提:
#   - sf CLI がインストール済みで、対象組織に認証済みであること
#       例) sf org login web --alias sf-source
#   - jq がインストール済みであること
#   - 入力CSVに "Id" カラムが含まれること（先頭列でなくてもよい）
#
# 使い方:
#   ./scripts/download-content-version.sh [ORG_ALIAS] [CSV_PATH] [OUT_DIR] [PARALLEL]
#
# デフォルト:
#   ORG_ALIAS = sf-source
#   CSV_PATH  = sample/ContentVersion-master.csv
#   OUT_DIR   = sample/files
#   PARALLEL  = 1   (1=直列、2以上で並列)
#
# 出力:
#   OUT_DIR/<ContentVersionId>  (拡張子なし、Idがそのままファイル名)
#   ※ src-tauri/src/csv/processor.rs のフォルダ指定モードが期待する形式
#
# 特徴:
#   - 既存ファイルがあればスキップ（途中で止まっても再実行で続きから）
#   - 0バイトのゴミは残さない
#   - 失敗一覧を OUT_DIR/_failed.txt に追記
#

set -uo pipefail

ORG="${1:-sf-source}"
CSV="${2:-sample/ContentVersion-master.csv}"
OUT_DIR="${3:-sample/files}"
PARALLEL="${4:-1}"

# 依存チェック
for cmd in sf jq curl awk; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' が見つかりません" >&2
    exit 1
  fi
done

if [[ ! -f "$CSV" ]]; then
  echo "ERROR: CSVが見つかりません: $CSV" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
FAIL_LOG="$OUT_DIR/_failed.txt"

# 認証情報を取得
echo "組織情報を取得中: $ORG"
ORG_JSON=$(sf org display --target-org "$ORG" --json 2>/dev/null) || {
  echo "ERROR: 組織 '$ORG' の情報取得に失敗。先に 'sf org login web --alias $ORG' を実行してください" >&2
  exit 1
}
INSTANCE=$(echo "$ORG_JSON" | jq -r .result.instanceUrl)
TOKEN=$(echo "$ORG_JSON" | jq -r .result.accessToken)

if [[ -z "$INSTANCE" || -z "$TOKEN" || "$INSTANCE" == "null" || "$TOKEN" == "null" ]]; then
  echo "ERROR: instanceUrl / accessToken の取得に失敗" >&2
  exit 1
fi

echo "接続先: $INSTANCE"

# CSVヘッダーから "Id" 列の位置を特定（BOM除去）
HEADER=$(head -1 "$CSV" | sed 's/^\xef\xbb\xbf//')
ID_COL=$(echo "$HEADER" | awk -F',' '{
  for (i=1; i<=NF; i++) {
    gsub(/"/, "", $i)
    gsub(/^[ \t]+|[ \t]+$/, "", $i)
    if ($i == "Id") { print i; exit }
  }
}')

if [[ -z "$ID_COL" ]]; then
  echo "ERROR: CSVに 'Id' カラムが見つかりません: $HEADER" >&2
  exit 1
fi

echo "Id列インデックス: $ID_COL"

# 全件数
TOTAL=$(($(wc -l < "$CSV") - 1))
echo "対象件数: $TOTAL"
echo "出力先: $OUT_DIR"
echo "並列度: $PARALLEL"
echo

# 1件ダウンロードする関数
download_one() {
  local ID="$1"
  local OUT="$OUT_DIR/$ID"

  # 既存ファイルはスキップ
  if [[ -s "$OUT" ]]; then
    echo "SKIP $ID"
    return 0
  fi

  local HTTP
  HTTP=$(curl -sS -w "%{http_code}" -o "$OUT" \
    -H "Authorization: Bearer $TOKEN" \
    "$INSTANCE/services/data/v60.0/sobjects/ContentVersion/$ID/VersionData") || HTTP="000"

  if [[ "$HTTP" != "200" ]]; then
    rm -f "$OUT"
    echo "FAIL $ID HTTP=$HTTP" >&2
    echo "$ID" >> "$FAIL_LOG"
    return 1
  fi

  echo "OK   $ID"
}

export -f download_one
export OUT_DIR INSTANCE TOKEN FAIL_LOG

# Id列だけを抽出して実行
EXTRACT_IDS=$(tail -n +2 "$CSV" | sed 's/^\xef\xbb\xbf//' | awk -F',' -v col="$ID_COL" '{
  gsub(/"/, "", $col)
  gsub(/^[ \t]+|[ \t]+$/, "", $col)
  if ($col != "") print $col
}')

START_TS=$(date +%s)

if [[ "$PARALLEL" -gt 1 ]]; then
  echo "$EXTRACT_IDS" | xargs -n 1 -P "$PARALLEL" -I{} bash -c 'download_one "$@"' _ {} \
    | awk -v total="$TOTAL" '
      BEGIN { ok=0; skip=0; fail=0 }
      /^OK / { ok++ }
      /^SKIP / { skip++ }
      /^FAIL / { fail++ }
      {
        done = ok + skip + fail
        printf "\r[%d/%d] OK=%d SKIP=%d FAIL=%d", done, total, ok, skip, fail
      }
      END { printf "\n" }
    '
else
  i=0; ok=0; skip=0; fail=0
  while IFS= read -r ID; do
    i=$((i+1))
    RESULT=$(download_one "$ID" 2>&1)
    case "$RESULT" in
      OK*)   ok=$((ok+1)) ;;
      SKIP*) skip=$((skip+1)) ;;
      FAIL*) fail=$((fail+1)) ;;
    esac
    printf "\r[%d/%d] OK=%d SKIP=%d FAIL=%d" "$i" "$TOTAL" "$ok" "$skip" "$fail"
  done <<< "$EXTRACT_IDS"
  echo
fi

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

echo
echo "完了 (経過: ${ELAPSED}秒)"
if [[ -s "$FAIL_LOG" ]]; then
  FAIL_COUNT=$(wc -l < "$FAIL_LOG" | tr -d ' ')
  echo "失敗 $FAIL_COUNT 件: $FAIL_LOG"
  echo "再実行すれば失敗分のみ再試行されます"
else
  echo "失敗なし"
fi
