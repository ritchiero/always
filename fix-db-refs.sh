#!/bin/bash
# Fix all db references to use getDb()

cd /home/ubuntu/always/functions/src

for file in daily-summary.ts index.ts indexing.ts migrate-recordings.ts reprocess-all.ts; do
  echo "Fixing $file..."
  # Replace '= db' with '= getDb()'
  sed -i.backup 's/ = db$/ = getDb()/g' "$file"
  sed -i.backup2 's/ = db;/ = getDb();/g' "$file"
  sed -i.backup3 's/ = db\./ = getDb()./g' "$file"
  sed -i.backup4 's/(db\./(getDb()./g' "$file"
  sed -i.backup5 's/(db)/(getDb())/g' "$file"
done

echo "Done!"
