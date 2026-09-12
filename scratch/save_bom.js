const fs = require('fs');

let content = fs.readFileSync('sync_content.ps1', 'utf8');

// Ensure matching author note regex safely without emoji encoding issues
content = content.replace(
  /if \(\$indexContent -match '\(\?m\)\^## .*?作者的話'\)/,
  "if ($indexContent -match '(?m)^## .*?作者的話')"
);
content = content.replace(
  /\(\$guideSection \+ "`r`n`r`n## .*?作者的話"\)/,
  '($guideSection + "`r`n`r`n" + $Matches[0])'
);

// Save with UTF-8 BOM
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
const buf = Buffer.concat([bom, Buffer.from(content, 'utf8')]);
fs.writeFileSync('sync_content.ps1', buf);
console.log('Successfully saved sync_content.ps1 with UTF-8 BOM');
