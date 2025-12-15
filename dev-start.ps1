# Development Environment Startup Script (PowerShell)
# This script starts all services needed for local development

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Track Rental Development Environment" -ForegroundColor Green

# Check for environment files
$envFile = $null
if (Test-Path ".env.local") {
    $envFile = ".env.local"
} elseif (Test-Path ".env") {
    $envFile = ".env"
} else {
    Write-Host "⚠️  No .env or .env.local file found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please create a .env.local file with your configuration:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host @"
STRIPE_API_KEY=sk_test_your_stripe_secret_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rc_track_rental
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
"@
    Write-Host ""
    Write-Host "📝 Get your Stripe API key from: https://dashboard.stripe.com/test/apikeys" -ForegroundColor Yellow
    Write-Host "📝 Generate NEXTAUTH_SECRET with: openssl rand -base64 32" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press enter once you've created .env.local with your STRIPE_API_KEY"
    
    # Check again
    if (Test-Path ".env.local") {
        $envFile = ".env.local"
    } elseif (Test-Path ".env") {
        $envFile = ".env"
    } else {
        Write-Host "❌ Still no environment file found. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host "📄 Using environment file: $envFile" -ForegroundColor Green

# Load environment variables
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

Write-Host "✅ Environment variables loaded" -ForegroundColor Green

# Check if Stripe API key is set
$stripeKey = [Environment]::GetEnvironmentVariable("STRIPE_API_KEY", "Process")
if ([string]::IsNullOrEmpty($stripeKey) -or $stripeKey -eq "sk_test_your_stripe_secret_key_here") {
    Write-Host "⚠️  STRIPE_API_KEY is not set or is using the example value" -ForegroundColor Yellow
    Write-Host "   Please edit $envFile and add your Stripe test API key" -ForegroundColor Yellow
    Write-Host "   Get it from: https://dashboard.stripe.com/test/apikeys" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Continuing anyway, but Stripe webhook forwarding won't work..." -ForegroundColor Yellow
    Write-Host ""
    Start-Sleep -Seconds 2
}

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Green
docker-compose up -d

# Wait for services to be healthy
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Green
Start-Sleep -Seconds 5

# Display Stripe webhook secret
Write-Host ""
Write-Host "🎯 Getting Stripe webhook secret..." -ForegroundColor Green
Write-Host "📋 Run this command to see your webhook secret:" -ForegroundColor Yellow
Write-Host "   docker-compose logs stripe-cli | Select-String 'whsec_'"
Write-Host ""
Write-Host "💡 Add this to your $envFile:" -ForegroundColor Yellow
Write-Host "   STRIPE_WEBHOOK_SECRET=whsec_..."
Write-Host ""

# Display service URLs
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Service URLs:" -ForegroundColor Green
Write-Host "   Next.js App:        http://localhost:3000"
Write-Host "   Postgres:           localhost:5432"
Write-Host "   Adminer (DB UI):    http://localhost:8081"
Write-Host "   MinIO Console:      http://localhost:9001"
Write-Host "   MailHog UI:         http://localhost:8025"
Write-Host "   WireMock:           http://localhost:8080"
Write-Host "   Stripe Mock:        http://localhost:12111"
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Green
Write-Host "   1. Copy the Stripe webhook secret from the logs above"
Write-Host "   2. Add it to your $envFile file as STRIPE_WEBHOOK_SECRET"
Write-Host "   3. Run 'npm run dev' to start the Next.js app"
Write-Host "   4. Run 'npm run db:push' if you haven't initialized the database"
Write-Host ""
Write-Host "💡 To see Stripe webhook logs:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f stripe-cli"
Write-Host ""
Write-Host "🛑 To stop all services:" -ForegroundColor Yellow
Write-Host "   docker-compose down"
Write-Host ""

