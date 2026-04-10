#!/usr/bin/env bash
#
# 0バイト = 外部リンク（Quipなど ContentLocation:E）の ContentVersion を
# アプリのインポート対象から除外するためのクリーンアップスクリプト。
#
# 処理内容:
#   1. sample/files/ から 0バイトファイル一覧を取得
#   2. それらの ContentVersion を Salesforce REST API で問い合わせて
#      sample/excluded-quip-links.csv に出力（後工程で別途処理するため）
#   3. sample/ContentVersion-master.csv から該当行を除外
#   4. sample/ContentDocumentLink.csv から該当ContentDocumentIdの行を除外
#   5. sample/files/ から 0バイトファイルを削除
#
# 元ファイルは .bak としてバックアップを取る。
# 再実行可能（既に除外済みなら何もしない）。
#
# 前提:
#   - sf CLI で対象組織に認証済み
#   - jq, awk が利用可能
#
# 使い方:
#   ./scripts/exclude-external-links.sh [ORG_ALIAS]
#

set -uo pipefail

ORG="${1:-sf-source}"
SAMPLE_DIR="sample"
FILES_DIR="$SAMPLE_DIR/files"
CV_CSV="$SAMPLE_DIR/ContentVersion-master.csv"
CDL_CSV="$SAMPLE_DIR/ContentDocumentLink.csv"
EXCLUDED_CSV="$SAMPLE_DIR/excluded-quip-links.csv"
API_VERSION="v60.0"

# 依存チェック
for cmd in sf jq awk find; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: '$cmd' が見つかりません" >&2; exit 1; }
done

[[ -f "$CV_CSV" ]] || { echo "ERROR: $CV_CSV が見つかりません" >&2; exit 1; }
[[ -f "$CDL_CSV" ]] || { echo "ERROR: $CDL_CSV が見つかりません" >&2; exit 1; }
[[ -d "$FILES_DIR" ]] || { echo "ERROR: $FILES_DIR が見つかりません" >&2; exit 1; }

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# 1. 0バイトファイル一覧を取得
echo "[1/5] 0バイトファイルを検出中..."
ZERO_IDS_FILE="$TMP_DIR/zero_ids.txt"
find "$FILES_DIR" -type f -size 0 -exec basename {} \; | sort -u > "$ZERO_IDS_FILE"
ZERO_COUNT=$(wc -l < "$ZERO_IDS_FILE" | tr -d ' ')

if [[ "$ZERO_COUNT" -eq 0 ]]; then
  echo "0バイトファイルなし。何もすることがありません。"
  exit 0
fi

echo "検出: $ZERO_COUNT 件"
cat "$ZERO_IDS_FILE" | sed 's/^/  - /'

# 2. ContentVersion ID から ContentDocumentId を引く
echo
echo "[2/5] 該当ContentDocumentIdを抽出中..."
ZERO_CDIDS_FILE="$TMP_DIR/zero_cdids.txt"
awk -F',' 'BEGIN{
  while ((getline line < "'"$ZERO_IDS_FILE"'") > 0) ids[line] = 1
}
NR > 1 {
  id = $1; cdid = $2
  gsub(/"/, "", id); gsub(/"/, "", cdid)
  gsub(/^[ \t]+|[ \t]+$/, "", id); gsub(/^[ \t]+|[ \t]+$/, "", cdid)
  if (id in ids) print cdid
}' "$CV_CSV" | sort -u > "$ZERO_CDIDS_FILE"

CDID_COUNT=$(wc -l < "$ZERO_CDIDS_FILE" | tr -d ' ')
echo "対応 ContentDocumentId: $CDID_COUNT 件"

# 3. Salesforce APIで メタデータ取得 + CDLから LinkedEntityId引いて excluded-quip-links.csv 出力
echo
echo "[3/5] Quipリンクメタデータを取得して $EXCLUDED_CSV に出力中..."

ORG_JSON=$(sf org display --target-org "$ORG" --json 2>/dev/null) || {
  echo "ERROR: 組織 '$ORG' の認証情報取得失敗" >&2
  exit 1
}
INSTANCE=$(echo "$ORG_JSON" | jq -r .result.instanceUrl)
TOKEN=$(echo "$ORG_JSON" | jq -r .result.accessToken)

# IN句構築
IN_LIST=$(awk 'BEGIN{ORS=""} { if (NR>1) printf ","; printf "'\''%s'\''", $0 }' "$ZERO_IDS_FILE")
SOQL="SELECT Id, ContentDocumentId, Title, FileType, ContentLocation, ContentSize, ExternalDocumentInfo1, ExternalDocumentInfo2, CreatedDate FROM ContentVersion WHERE Id IN ($IN_LIST)"
ENCODED=$(jq -sRr @uri <<< "$SOQL")

API_RESPONSE=$(curl -sS -H "Authorization: Bearer $TOKEN" "$INSTANCE/services/data/$API_VERSION/query?q=$ENCODED")

ERROR_CODE=$(echo "$API_RESPONSE" | jq -r 'if type == "array" then (.[0].errorCode // empty) else (.errorCode // empty) end')
if [[ -n "$ERROR_CODE" ]]; then
  echo "ERROR: SOQL失敗: $ERROR_CODE" >&2
  echo "$API_RESPONSE" >&2
  exit 1
fi

# CDLから ContentDocumentId -> LinkedEntityId のマップを作る（複数あるのでカンマ連結）
LE_MAP_FILE="$TMP_DIR/le_map.txt"
awk -F',' 'BEGIN{
  while ((getline line < "'"$ZERO_CDIDS_FILE"'") > 0) target[line] = 1
}
NR > 1 {
  cdid = $1; linked = $4
  gsub(/"/, "", cdid); gsub(/"/, "", linked)
  if (cdid in target && linked != "") {
    if (cdid in result) result[cdid] = result[cdid] "|" linked
    else result[cdid] = linked
  }
}
END {
  for (k in result) print k "\t" result[k]
}' "$CDL_CSV" > "$LE_MAP_FILE"

# excluded-quip-links.csv 出力
{
  echo '"ContentVersionId","ContentDocumentId","Title","FileType","ContentLocation","ContentSize","ExternalDocumentInfo1","ExternalDocumentInfo2","CreatedDate","LinkedEntityIds"'
  echo "$API_RESPONSE" | jq -r --slurpfile le <(awk -F'\t' '{printf "{\"cdid\":\"%s\",\"linked\":\"%s\"}\n", $1, $2}' "$LE_MAP_FILE" | jq -s '.') '
    .records[] as $r |
    ($le[0] | map(select(.cdid == $r.ContentDocumentId)) | .[0].linked // "") as $linked |
    [$r.Id, $r.ContentDocumentId, $r.Title, $r.FileType, $r.ContentLocation, ($r.ContentSize|tostring), $r.ExternalDocumentInfo1, $r.ExternalDocumentInfo2, $r.CreatedDate, $linked] | @csv'
} > "$EXCLUDED_CSV"

EXCLUDED_ROWS=$(($(wc -l < "$EXCLUDED_CSV" | tr -d ' ') - 1))
echo "出力: $EXCLUDED_CSV ($EXCLUDED_ROWS 件)"

# 4. master CSV から除外
echo
echo "[4/5] $CV_CSV から該当行を除外中..."
cp "$CV_CSV" "${CV_CSV}.bak"
BEFORE_CV=$(($(wc -l < "$CV_CSV" | tr -d ' ') - 1))

awk -F',' 'BEGIN{
  while ((getline line < "'"$ZERO_IDS_FILE"'") > 0) ids[line] = 1
}
NR == 1 { print; next }
{
  id = $1
  gsub(/"/, "", id)
  gsub(/^[ \t]+|[ \t]+$/, "", id)
  if (!(id in ids)) print
}' "${CV_CSV}.bak" > "$CV_CSV"

AFTER_CV=$(($(wc -l < "$CV_CSV" | tr -d ' ') - 1))
echo "$BEFORE_CV → $AFTER_CV ($((BEFORE_CV - AFTER_CV)) 件除外)"

# 5. CDL から除外 + ファイル削除
echo
echo "[5/5] $CDL_CSV から該当行を除外中..."
cp "$CDL_CSV" "${CDL_CSV}.bak"
BEFORE_CDL=$(($(wc -l < "$CDL_CSV" | tr -d ' ') - 1))

awk -F',' 'BEGIN{
  while ((getline line < "'"$ZERO_CDIDS_FILE"'") > 0) cdids[line] = 1
}
NR == 1 { print; next }
{
  cdid = $1
  gsub(/"/, "", cdid)
  gsub(/^[ \t]+|[ \t]+$/, "", cdid)
  if (!(cdid in cdids)) print
}' "${CDL_CSV}.bak" > "$CDL_CSV"

AFTER_CDL=$(($(wc -l < "$CDL_CSV" | tr -d ' ') - 1))
echo "$BEFORE_CDL → $AFTER_CDL ($((BEFORE_CDL - AFTER_CDL)) 件除外)"

# 6. 0バイトファイル削除
echo
echo "0バイトファイルを削除中..."
DELETED=0
while IFS= read -r id; do
  if [[ -f "$FILES_DIR/$id" ]]; then
    rm "$FILES_DIR/$id"
    DELETED=$((DELETED + 1))
  fi
done < "$ZERO_IDS_FILE"
echo "削除: $DELETED 件"

echo
echo "===================="
echo "完了"
echo "===================="
echo "除外CSV:    $EXCLUDED_CSV ($EXCLUDED_ROWS 件)"
echo "ContentVersion-master.csv: $AFTER_CV 件 (バックアップ: ${CV_CSV}.bak)"
echo "ContentDocumentLink.csv:   $AFTER_CDL 件 (バックアップ: ${CDL_CSV}.bak)"
echo "files/:                    削除 $DELETED 件"
