$lines = [System.IO.File]::ReadAllLines("$PSScriptRoot\script.js")
$count = 0
$fns = [System.Collections.ArrayList]::new()

for ($i = 22441; $i -lt 40569; $i++) {
    if ($lines[$i] -match '^\s+(async )?function (\w+)') {
        $count++
        $lineNum = $i + 1
        $trimmed = $lines[$i].Trim()
        [void]$fns.Add("${lineNum}: $trimmed")
    }
}

Write-Host "Total: $count"
foreach ($f in $fns) {
    Write-Host $f
}
