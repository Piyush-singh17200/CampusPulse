$dotenv = Get-Content .env
foreach ($line in $dotenv) {
    if ($line -match '^DATABASE_URL="([^"]+)"') {
        $env:DATABASE_URL = $matches[1]
    }
}
npm run dev
