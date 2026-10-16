#!/bin/sh
# Stamp a fresh ?v= on the CSS/JS links in the pages so browsers never mix
# an old cached script with a new page. Run before each commit that changes css/ or js/.
cd "$(dirname "$0")" && v=$(date +%Y%m%d%H%M) &&
sed -i '' -E "s/(styles\.css|projects\.js|sync\.js|app\.js)(\?v=[0-9]+)?\"/\1?v=$v\"/g" index.html overview.html &&
echo "index.html and overview.html now use ?v=$v"
