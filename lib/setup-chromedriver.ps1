Param(
    [string]$version
)

$chrome_fullversion = (Get-Item "C:\Program Files\Google\Chrome\Application\chrome.exe").VersionInfo.FileVersion

Write-Output "Chrome version: $chrome_fullversion"
if([string]::IsNullOrEmpty($version))
{
    $chrome_majorversion = $chrome_fullversion.Split(".")[0]
}
else
{
    $chrome_majorversion = $version.Split(".")[0]
}
if($chrome_majorversion -lt 115)
{
    $response = Invoke-WebRequest "http://chromedriver.storage.googleapis.com/LATEST_RELEASE_$chrome_majorversion"
    $version = $response.Content
    Invoke-WebRequest "https://chromedriver.storage.googleapis.com/$version/chromedriver_win32.zip" -OutFile chromedriver_win32.zip
    Expand-Archive -Path chromedriver_win32.zip -DestinationPath C:\SeleniumWebDrivers\ChromeDriver -Force
    Remove-Item chromedriver_win32.zip
}
else
{
    if([string]::IsNullOrEmpty($version))
    {
        $version = $chrome_fullversion
    }
    $arch = "win32"
    Write-Output $arch
    $url = Invoke-WebRequest "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json" -UseBasicParsing | ConvertFrom-Json | Select-Object -ExpandProperty versions | Where-Object { $_.version -eq $version } | Select-Object -ExpandProperty downloads | Select-Object -ExpandProperty chromedriver | Where-Object { $_.platform -eq $arch } | Select-Object -ExpandProperty url
    Invoke-WebRequest $url -OutFile chromedriver-win32.zip
    Expand-Archive -Path chromedriver-win32.zip -Force
    Move-Item -Path .\chromedriver-win32\chromedriver-win32\chromedriver.exe -Destination C:\SeleniumWebDrivers\ChromeDriver -Force
    Remove-Item chromedriver-win32.zip
}
