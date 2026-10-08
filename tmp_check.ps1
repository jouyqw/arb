$j = Get-Content 'C:\Users\c\arb\content\queue\hospital-marketing-channel-mix.json' -Raw | ConvertFrom-Json
$sb = New-Object System.Text.StringBuilder
$h = 0; $t = 0
foreach ($b in $j.body) {
  if ($b -is [string]) { [void]$sb.Append($b); continue }
  switch ($b.type) {
    'summary' { [void]$sb.Append($b.title); $b.items | ForEach-Object { [void]$sb.Append($_) } }
    'heading' { $h++; [void]$sb.Append($b.text) }
    'table'   { $t++; $b.headers | ForEach-Object { [void]$sb.Append($_) }; foreach ($r in $b.rows) { $r | ForEach-Object { [void]$sb.Append($_) } } }
    'list'    { $b.items | ForEach-Object { [void]$sb.Append($_) } }
    'callout' { [void]$sb.Append($b.label + $b.text) }
    'warning' { [void]$sb.Append($b.label + $b.text) }
    'faq'     { [void]$sb.Append($b.title); foreach ($i in $b.items) { [void]$sb.Append($i.q + $i.a) } }
  }
}
$all = $sb.ToString()
$ns = $all -replace '\s', ''
"chars_with_space: $($all.Length)"
"chars_no_space:   $($ns.Length)"
"headings: $h / tables: $t"
"title_len: $($j.title.Length) / desc_len: $($j.description.Length)"
"first_block: $($j.body[0].type)"
"second_to_last: $($j.body[$j.body.Count - 2].type)"
$faq = $j.body | Where-Object { $_.type -eq 'faq' }
"faq_items: $($faq.items.Count)"
"kw_body: $([regex]::Matches($all, '병원마케팅').Count) / title: $([regex]::Matches($j.title, '병원마케팅').Count) / desc: $([regex]::Matches($j.description, '병원마케팅').Count)"
"first_person: $([regex]::Matches($all, '저는|저희').Count)"
$bad = '1위 보장', '무조건', '100%', '최저가', '반드시 상위노출'
foreach ($w in $bad) { if ($all -match [regex]::Escape($w)) { "BAN_HIT: $w" } }
foreach ($b in $j.body) { if ($b -isnot [string] -and $b.type -eq 'table') { foreach ($r in $b.rows) { if ($r.Count -ne $b.headers.Count) { "ROW_MISMATCH" } } } }
"keywords: $($j.keywords.Count)"
