"""
Riftbound TCGCSV Downloader - Downloads card price data from TCGPlayer CSV
and uploads to Firebase Realtime Database.

This script extracts specific columns including subTypeName for variant disambiguation.
"""

import csv
import json
import requests
from firebase_admin import credentials, initialize_app, db

# Firebase Admin SDK setup (use service account key)
# Download this from Firebase Console > Project Settings > Service Accounts
cred = credentials.Certificate('path/to/your-service-account-key.json')
initialize_app(cred, {
    'databaseURL': 'https://your-project.firebaseio.com'
})

# TCGCSV download URL (replace with actual Riftbound CSV URL)
TCGCSV_URL = "https://www.tcgplayer.com/api/download/csv"

# Columns to extract - includes subTypeName for variant disambiguation
COLUMNS_TO_EXTRACT = [
    "productId",
    "name",
    "cleanName",
    "lowPrice",
    "midPrice",
    "highPrice",
    "marketPrice",
    "extNumber",
    "subTypeName"  # Added: "Normal" | "Foil" | "Showcase" | "Serial Numbered" | etc.
]

def download_csv(url: str) -> list[dict]:
    """Download and parse the TCGCSV file."""
    response = requests.get(url)
    response.raise_for_status()
    
    # Parse CSV
    lines = response.text.splitlines()
    reader = csv.DictReader(lines)
    
    return list(reader)

def filter_and_transform(data: list[dict]) -> dict[str, dict]:
    """Filter to only Riftbound cards and extract only needed columns."""
    result = {}
    
    for row in data:
        # Filter for Riftbound set (adjust filter criteria as needed)
        if row.get('expansion') != 'Riftbound':
            continue
        
        # Extract only the columns we need
        extracted = {}
        for col in COLUMNS_TO_EXTRACT:
            value = row.get(col, '')
            
            # Convert price fields to numbers or null
            if col in ['lowPrice', 'midPrice', 'highPrice', 'marketPrice']:
                try:
                    extracted[col] = float(value) if value else None
                except (ValueError, TypeError):
                    extracted[col] = None
            else:
                extracted[col] = str(value).strip()
        
        # Use productId as the key
        product_id = extracted.get('productId', '')
        if product_id:
            result[product_id] = extracted
    
    return result

def upload_to_firebase(data: dict[str, dict]):
    """Upload the processed data to Firebase Realtime Database."""
    ref = db.reference('riftbound_prices_tcgcsv')
    ref.set(data)
    print(f"Uploaded {len(data)} card prices to Firebase")

def main():
    print("Downloading TCGCSV data...")
    raw_data = download_csv(TCGCSV_URL)
    print(f"Downloaded {len(raw_data)} rows")
    
    print("Filtering and transforming data...")
    filtered_data = filter_and_transform(raw_data)
    print(f"Filtered to {len(filtered_data)} Riftbound cards")
    
    print("Uploading to Firebase...")
    upload_to_firebase(filtered_data)
    
    print("Done!")

if __name__ == "__main__":
    main()
