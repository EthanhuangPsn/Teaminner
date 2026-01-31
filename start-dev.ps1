# Game Voice Service - Dev Environment Startup Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Game Voice Service - Starting Dev Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for cnpm
$cnpmInstalled = Get-Command cnpm -ErrorAction SilentlyContinue
if (-not $cnpmInstalled) {
    Write-Host "Installing cnpm..." -ForegroundColor Yellow
    npm install -g cnpm --registry=https://registry.npmmirror.com
}

# Kill existing processes on ports 3000 and 5173
Write-Host "Cleaning up existing ports..." -ForegroundColor Yellow
$ports = 3000, 5173
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Closing process on port $port..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Start Backend
Write-Host "Starting Backend Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd backend; npm run start:dev`"" -WindowStyle Normal

# Wait for backend
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit -Command `"cd frontend; npm run dev`"" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Startup sequence complete!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
