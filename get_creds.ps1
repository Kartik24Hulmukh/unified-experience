[void][Windows.Security.Credentials.PasswordVault, Windows.Security.Credentials, ContentType=WindowsRuntime]
$vault = New-Object Windows.Security.Credentials.PasswordVault
$creds = @()
try { $creds += $vault.FindAllByResource('git:https://github.com') } catch {}
try { $creds += $vault.FindAllByResource('git:https://Kartik24Hulmukh@github.com') } catch {}
foreach ($cred in $creds) {
    try {
        $cred.RetrievePassword()
        Write-Output "User: $($cred.UserName) Pass: $($cred.Password)"
    } catch {}
}
