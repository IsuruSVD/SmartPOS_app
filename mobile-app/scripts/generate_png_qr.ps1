Add-Type -AssemblyName System.Drawing
Set-Location "C:\Users\isuru\OneDrive\Documents\GitHub\SmartPOS_app\mobile-app"

$url = "exps://c-isurusvd-cawxof-mwlyew9yse7sevl9.on.expo.app"
$rawJson = node -e "const { toQR } = require('toqr'); console.log(JSON.stringify(Array.from(toQR('$url'))));"
$modules = ConvertFrom-Json $rawJson
$side = [int][Math]::Sqrt($modules.Count)

$scale = 12
$margin = 4
$imgSide = ($side + ($margin * 2)) * $scale

$bmp = New-Object System.Drawing.Bitmap $imgSide, $imgSide
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.Clear([System.Drawing.Color]::White)
$blackBrush = [System.Drawing.Brushes]::Black

for ($r = 0; $r -lt $side; $r++) {
    for ($c = 0; $c -lt $side; $c++) {
        $val = $modules[$r * $side + $c]
        if ($val -ne 0) {
            $gfx.FillRectangle($blackBrush, ($c + $margin) * $scale, ($r + $margin) * $scale, $scale, $scale)
        }
    }
}

$outPath = "C:\Users\isuru\OpenBot\Shared\smartpos-sdk58-tunnel-qr.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated PNG at $outPath ($imgSide x $imgSide)"
