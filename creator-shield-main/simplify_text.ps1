$file = 'src\components\dashboard\InteractiveVideoModal.tsx'
$content = Get-Content $file -Raw -Encoding UTF8

$content = $content.Replace('Originality Breakdown', 'How Original Is This Video?')
$content = $content.Replace('Computing script, thumbnail, and audio uniqueness scores...', 'Checking how unique your script, thumbnail, and voice are...')
$content = $content.Replace('"Script Originality"', '"Is My Script Unique?"')
$content = $content.Replace('"Thumbnail Originality"', '"Is My Thumbnail Original?"')
$content = $content.Replace('"Visual Diversity"', '"Are Visuals Diverse?"')
$content = $content.Replace('"Voice Uniqueness"', '"Is It My Own Voice?"')
$content = $content.Replace('"Metadata Originality"', '"Title and Tags Safe?"')
$content = $content.Replace('Detected Findings', 'What We Found')

Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Host "Done! Text simplified successfully."
