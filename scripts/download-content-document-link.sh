#!/usr/bin/env bash
#
# ContentVersionのCSVに含まれるContentDocumentIdを元に、
# 対応するContentDocumentLinkをSalesforce REST APIから取得してCSVに出力する。
#
# ContentDocumentLinkは SOQL の WHERE 必須かつ
# `WHERE ContentDocumentId IN (...)` または `WHERE LinkedEntityId IN (...)` でしか
# クエリできないという固有の制約があるため、ContentDocumentIdを
# バッチサイズずつ IN 句に詰めて複数回クエリする方式を取る。
#
# 前提:
#   - sf CLI がインストール済みで、対象組織に認証済みであること
#       例) sf org login web --alias sf-source
#   - jq がインストール済みであること
#   - 入力CSVに "ContentDocumentId" カラムが含まれること
#
# 使い方:
#   ./scripts/download-content-document-link.sh [ORG_ALIAS] [INPUT_CSV] [OUTPUT_CSV] [BATCH_SIZE]
#
# デフォルト:
#   ORG_ALIAS   = sf-source
#   INPUT_CSV   = sample/ContentVersion-master.csv
#   OUTPUT_CSV  = sample/ContentDocumentLink.csv  (上書き)
#   BATCH_SIZE  = 200   (1リクエストあたりのContentDocumentId数)
#

set -uo pipefail

ORG="${1:-sf-source}"
INPUT_CSV="${2:-sample/ContentVersion-master.csv}"
OUTPUT_CSV="${3:-sample/ContentDocumentLink.csv}"
BATCH_SIZE="${4:-200}"
API_VERSION="v60.0"

# 依存チェック
for cmd in sf jq curl awk split; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: '$cmd' が見つかりません" >&2
    exit 1
  fi
done

if [[ ! -f "$INPUT_CSV" ]]; then
  echo "ERROR: 入力CSVが見つかりません: $INPUT_CSV" >&2
  exit 1
fi

# 一時ディレクトリ
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

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

# CSVヘッダーから ContentDocumentId 列の位置を特定（BOM除去）
HEADER=$(head -1 "$INPUT_CSV" | sed 's/^\xef\xbb\xbf//')
CDID_COL=$(echo "$HEADER" | awk -F',' '{
  for (i=1; i<=NF; i++) {
    gsub(/"/, "", $i)
    gsub(/^[ \t]+|[ \t]+$/, "", $i)
    if ($i == "ContentDocumentId") { print i; exit }
  }
}')

if [[ -z "$CDID_COL" ]]; then
  echo "ERROR: 入力CSVに 'ContentDocumentId' カラムが見つかりません: $HEADER" >&2
  exit 1
fi

echo "ContentDocumentId列インデックス: $CDID_COL"

# ユニークなContentDocumentIdを抽出
IDS_FILE="$TMP_DIR/ids.txt"
tail -n +2 "$INPUT_CSV" | sed 's/^\xef\xbb\xbf//' | awk -F',' -v col="$CDID_COL" '{
  gsub(/"/, "", $col)
  gsub(/^[ \t]+|[ \t]+$/, "", $col)
  if ($col != "") print $col
}' | sort -u > "$IDS_FILE"

TOTAL_IDS=$(wc -l < "$IDS_FILE" | tr -d ' ')
echo "ユニークContentDocumentId: $TOTAL_IDS 件"

if [[ "$TOTAL_IDS" -eq 0 ]]; then
  echo "ERROR: ContentDocumentIdが0件です" >&2
  exit 1
fi

# バッチに分割
SPLIT_DIR="$TMP_DIR/batches"
mkdir -p "$SPLIT_DIR"
split -l "$BATCH_SIZE" "$IDS_FILE" "$SPLIT_DIR/batch_"
BATCH_FILES=("$SPLIT_DIR"/batch_*)
TOTAL_BATCHES=${#BATCH_FILES[@]}
echo "バッチ数: $TOTAL_BATCHES (size=$BATCH_SIZE)"
echo "出力先: $OUTPUT_CSV (上書き)"
echo

# 出力CSVヘッダー（既存ファイルと同じ7カラム形式）
printf '"ContentDocumentId","Id","IsDeleted","LinkedEntityId","ShareType","SystemModstamp","Visibility"\n' > "$OUTPUT_CSV"

# JSON→CSV変換用jqフィルタ
JQ_TO_CSV='.records[] | [.ContentDocumentId, .Id, .IsDeleted, .LinkedEntityId, .ShareType, .SystemModstamp, .Visibility] | @csv'

# URLエンコード関数
urlencode() {
  jq -sRr @uri <<< "$1"
}

batch_num=0
total_records=0
fail_batches=0
START_TS=$(date +%s)

for batch_file in "${BATCH_FILES[@]}"; do
  batch_num=$((batch_num + 1))

  # IN句を構築 ('id1','id2',...)
  IN_LIST=$(awk 'BEGIN{ORS=""} { if (NR>1) printf ","; printf "'\''%s'\''", $0 }' "$batch_file")

  SOQL="SELECT ContentDocumentId, Id, IsDeleted, LinkedEntityId, ShareType, SystemModstamp, Visibility FROM ContentDocumentLink WHERE ContentDocumentId IN ($IN_LIST)"
  ENCODED=$(urlencode "$SOQL")
  URL="$INSTANCE/services/data/$API_VERSION/query?q=$ENCODED"

  RESPONSE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$URL")

  # エラーチェック
  ERROR_CODE=$(echo "$RESPONSE" | jq -r 'if type == "array" then (.[0].errorCode // empty) else (.errorCode // empty) end')
  if [[ -n "$ERROR_CODE" ]]; then
    echo
    echo "FAIL batch $batch_num: $ERROR_CODE" >&2
    echo "$RESPONSE" | jq -r 'if type == "array" then (.[0].message // empty) else (.message // empty) end' >&2
    fail_batches=$((fail_batches + 1))
    continue
  fi

  # 1ページ目を出力
  COUNT=$(echo "$RESPONSE" | jq -r '.records | length')
  echo "$RESPONSE" | jq -r "$JQ_TO_CSV" >> "$OUTPUT_CSV"
  total_records=$((total_records + COUNT))

  # 2000件超ならページング
  NEXT_URL=$(echo "$RESPONSE" | jq -r '.nextRecordsUrl // empty')
  while [[ -n "$NEXT_URL" ]]; do
    RESPONSE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$INSTANCE$NEXT_URL")
    COUNT2=$(echo "$RESPONSE" | jq -r '.records | length')
    echo "$RESPONSE" | jq -r "$JQ_TO_CSV" >> "$OUTPUT_CSV"
    total_records=$((total_records + COUNT2))
    NEXT_URL=$(echo "$RESPONSE" | jq -r '.nextRecordsUrl // empty')
  done

  printf "\r[%d/%d] batch完了 累計レコード=%d" "$batch_num" "$TOTAL_BATCHES" "$total_records"
done

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

echo
echo
echo "完了 (経過: ${ELAPSED}秒)"
echo "出力レコード: $total_records 件"
echo "出力先: $OUTPUT_CSV"

if [[ $fail_batches -gt 0 ]]; then
  echo "失敗バッチ: $fail_batches" >&2
  exit 1
fi
