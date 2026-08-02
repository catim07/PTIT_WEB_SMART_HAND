if (Test-Path "C:\Program Files\JetBrains\IntelliJ IDEA 2024.3.2.2\jbr") {
    $env:JAVA_HOME = "C:\Program Files\JetBrains\IntelliJ IDEA 2024.3.2.2\jbr"
} elseif (Test-Path "$env:USERPROFILE\.jdks\openjdk-23.0.2") {
    $env:JAVA_HOME = "$env:USERPROFILE\.jdks\openjdk-23.0.2"
}
if ($env:JAVA_HOME) {
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
}
Set-Location -Path "$PSScriptRoot\backend"
java "-Dfile.encoding=UTF-8" -jar target/backend-0.0.1-SNAPSHOT.jar


