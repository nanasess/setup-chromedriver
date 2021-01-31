Param(
    [string]$version
)

if([string]::IsNullOrEmpty($version))
{
    $chrome_fullversion = (Get-Item "C:\Program Files\Google\Chrome\Application\chrome.exe").VersionInfo.FileVersion
    $chrome_majorversion = $chrome_fullversion.Split(".")[0]
    $response = Invoke-WebRequest "http://chromedriver.storage.googleapis.com/LATEST_RELEASE_$chrome_majorversion"
    $version = $response.Content
}

Invoke-WebRequest "https://chromedriver.storage.googleapis.com/$version/chromedriver_win32.zip" -OutFile chromedriver_win32.zip

Expand-Archive -Path chromedriver_win32.zip -DestinationPath C:\SeleniumWebDrivers\ChromeDriver -Force
Remove-Item chromedriver_win32.zip
