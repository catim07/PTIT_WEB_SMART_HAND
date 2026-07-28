$env:JAVA_HOME = "C:\Program Files\JetBrains\IntelliJ IDEA 2024.3.2.2\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
Set-Location -Path "$PSScriptRoot\backend"
& "$env:JAVA_HOME\bin\java.exe" "-Dfile.encoding=UTF-8" -jar target/backend-0.0.1-SNAPSHOT.jar


