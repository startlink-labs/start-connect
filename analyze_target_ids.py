#!/usr/bin/env python3
import csv
from pathlib import Path
from collections import Counter
import sys

# CSVフィールドサイズ制限を増やす
csv.field_size_limit(sys.maxsize)

def analyze_target_ids():
    content_version_path = Path("/Users/ririi/Dev/Project/StartLintk/Earthcom/file-trans/salesforce-hubspot-file-sync/ContentVersion.csv")
    content_document_link_path = Path("/Users/ririi/Dev/Project/StartLintk/Earthcom/file-trans/salesforce-hubspot-file-sync/ContentDocumentLink.csv")
    
    # 001と003プレフィックスのContentDocumentIdを抽出
    target_prefixes = ['001', '003']
    target_content_ids = set()
    
    print("=== 001と003プレフィックスの分析 ===")
    with open(content_document_link_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        prefix_counts = Counter()
        target_records = []
        
        for row in reader:
            linked_entity_id = row.get('LinkedEntityId', '')
            content_document_id = row.get('ContentDocumentId', '')
            
            if linked_entity_id and content_document_id and len(linked_entity_id) >= 3:
                prefix = linked_entity_id[:3]
                prefix_counts[prefix] += 1
                
                if prefix in target_prefixes:
                    target_content_ids.add(content_document_id)
                    target_records.append({
                        'prefix': prefix,
                        'linked_entity_id': linked_entity_id,
                        'content_document_id': content_document_id
                    })
    
    print(f"001プレフィックス: {prefix_counts['001']}件")
    print(f"003プレフィックス: {prefix_counts['003']}件")
    print(f"対象ContentDocumentId（ユニーク）: {len(target_content_ids)}件")
    print(f"対象レコード総数: {len(target_records)}件")
    
    # ContentVersion.csvのContentDocumentId収集
    cv_ids = set()
    with open(content_version_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if 'ContentDocumentId' in row and row['ContentDocumentId']:
                cv_ids.add(row['ContentDocumentId'])
    
    # マッチング分析
    matches = target_content_ids.intersection(cv_ids)
    print(f"\nContentVersion.csvとのマッチ: {len(matches)}件")
    
    if matches:
        print(f"マッチしたID例: {list(matches)[:10]}")
    
    # マッチしなかった理由を調査
    print(f"\nマッチしなかった対象ID: {len(target_content_ids) - len(matches)}件")
    
    # 対象IDの一部をサンプル表示
    sample_target_ids = list(target_content_ids)[:20]
    sample_cv_ids = list(cv_ids)[:20]
    
    print(f"\n対象ID例（最初の20件）:")
    for i, id_val in enumerate(sample_target_ids):
        match_status = "✓" if id_val in cv_ids else "✗"
        print(f"  {i+1:2d}. {id_val} {match_status}")
    
    print(f"\nContentVersion ID例（最初の20件）:")
    for i, id_val in enumerate(sample_cv_ids):
        match_status = "✓" if id_val in target_content_ids else "✗"
        print(f"  {i+1:2d}. {id_val} {match_status}")
    
    # ID形式の比較
    print(f"\n=== ID形式分析 ===")
    target_id_lengths = Counter([len(id_val) for id_val in target_content_ids])
    cv_id_lengths = Counter([len(id_val) for id_val in cv_ids])
    
    print(f"対象ID長分布: {dict(target_id_lengths)}")
    print(f"ContentVersionID長分布: {dict(cv_id_lengths)}")

if __name__ == "__main__":
    analyze_target_ids()