$source = "C:\Users\joel1\.gemini\antigravity\brain\3582e0c3-83c1-4a4b-a855-4a921d7a6eb2\media__1774670176681.png"
$destApp = "d:\Carpetas\Desktop\Zona motores\web\Zona-Motores-main\src\app\icon.png"
$destPublic = "d:\Carpetas\Desktop\Zona motores\web\Zona-Motores-main\public\favicon.png"

if (Test-Path $source) {
    Copy-Item -Path $source -Destination $destApp -Force
    Copy-Item -Path $source -Destination $destPublic -Force
    Write-Host "Favicon copied successfully to both locations."
} else {
    Write-Error "Source file not found at $source"
}
