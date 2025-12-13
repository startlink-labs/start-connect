#!/usr/bin/env python3
import csv
from pathlib import Path
from collections import Counter
import sys

# CSVフィールドサイズ制限を増やす
csv.field_size_limit(sys.maxsize)

def analyze_csv_files():
    content_version_path = Path("/Users/ririi/Dev/Project/StartLintk/Earthcom/file-trans/salesforce-hubspot-file-sync/ContentVersion.csv")
    content_document_link_path = Path("/Users/ririi/Dev/Project/StartLintk/Earthcom/file-trans/salesforce-hubspot-file-sync/ContentDocumentLink.csv")
    
    print("=== ContentVersion.csv 分析 ===")
    if content_version_path.exists():
        # ヘッダー確認
        with open(content_version_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            print(f"ヘッダー: {headers}")
            
            # 最初の5行
            print("\n最初の5行:")
            for i, row in enumerate(reader):
                if i >= 5:
                    break
                print(f"行{i+1}: ContentDocumentId={row.get('ContentDocumentId', 'N/A')}, Id={row.get('Id', 'N/A')}, Title={row.get('Title', 'N/A')}")
        
        # 統計情報
        with open(content_version_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            content_doc_ids = []
            row_count = 0
            for row in reader:
                row_count += 1
                if 'ContentDocumentId' in row:
                    content_doc_ids.append(row['ContentDocumentId'])
            
            print(f"\n総行数: {row_count}")
            unique_content_doc_ids = len(set(content_doc_ids))
            print(f"ユニークなContentDocumentId: {unique_content_doc_ids}")
            print(f"ContentDocumentId例: {content_doc_ids[:10]}")
    else:
        print("ContentVersion.csvが見つかりません")
    
    print("\n=== ContentDocumentLink.csv 分析 ===")
    if content_document_link_path.exists():
        # ヘッダー確認
        with open(content_document_link_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            print(f"ヘッダー: {headers}")
            
            # 最初の5行
            print("\n最初の5行:")
            for i, row in enumerate(reader):
                if i >= 5:
                    break
                print(f"行{i+1}: ContentDocumentId={row.get('ContentDocumentId', 'N/A')}, LinkedEntityId={row.get('LinkedEntityId', 'N/A')}")
        
        # 統計情報
        with open(content_document_link_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            content_doc_ids = []
            linked_entity_ids = []
            is_deleted_values = []
            row_count = 0
            for row in reader:
                row_count += 1
                if 'ContentDocumentId' in row:
                    content_doc_ids.append(row['ContentDocumentId'])
                if 'LinkedEntityId' in row:
                    linked_entity_ids.append(row['LinkedEntityId'])
                if 'IsDeleted' in row:
                    is_deleted_values.append(row['IsDeleted'])
            
            print(f"\n総行数: {row_count}")
            unique_content_doc_ids = len(set(content_doc_ids))
            print(f"ユニークなContentDocumentId: {unique_content_doc_ids}")
            print(f"ContentDocumentId例: {content_doc_ids[:10]}")
            
            # IsDeleted分布
            is_deleted_counts = Counter(is_deleted_values)
            print(f"\nIsDeleted分布:")
            for value, count in is_deleted_counts.items():
                print(f"  {value}: {count}")
            
            # LinkedEntityIdのプレフィックス分析
            prefixes = [lid[:3] for lid in linked_entity_ids if len(lid) >= 3]
            prefix_counts = Counter(prefixes)
            print(f"\nLinkedEntityIdプレフィックス分布:")
            for prefix, count in prefix_counts.most_common(10):
                print(f"  {prefix}: {count}")
    else:
        print("ContentDocumentLink.csvが見つかりません")
    
    # 共通のContentDocumentIdを確認
    if content_version_path.exists() and content_document_link_path.exists():
        print("\n=== 共通ContentDocumentId分析 ===")
        
        # ContentVersion.csvのContentDocumentId収集
        cv_ids = set()
        with open(content_version_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'ContentDocumentId' in row and row['ContentDocumentId']:
                    cv_ids.add(row['ContentDocumentId'])
        
        # ContentDocumentLink.csvのContentDocumentId収集
        cdl_ids = set()
        with open(content_document_link_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'ContentDocumentId' in row and row['ContentDocumentId']:
                    cdl_ids.add(row['ContentDocumentId'])
        
        common_ids = cv_ids.intersection(cdl_ids)
        print(f"ContentVersion.csvのContentDocumentId数: {len(cv_ids)}")
        print(f"ContentDocumentLink.csvのContentDocumentId数: {len(cdl_ids)}")
        print(f"共通のContentDocumentId数: {len(common_ids)}")
        
        if common_ids:
            print(f"共通ID例: {list(common_ids)[:5]}")
        else:
            print("共通のContentDocumentIdが見つかりません！")
            print(f"ContentVersion例: {list(cv_ids)[:5]}")
            print(f"ContentDocumentLink例: {list(cdl_ids)[:5]}")

if __name__ == "__main__":
    analyze_csv_files()