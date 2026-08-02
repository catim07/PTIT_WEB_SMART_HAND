$env:JAVA_HOME = "C:\Program Files\JetBrains\IntelliJ IDEA 2024.3.2.2\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
Set-Location -Path "$PSScriptRoot\backend"
& .\mvnw.cmd package -DskipTests
