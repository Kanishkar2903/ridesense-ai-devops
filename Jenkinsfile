pipeline {

    agent any

    triggers {
        pollSCM('H/2 * * * *')
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {

        IMAGE_NAME = 'ridesense-ai'

        STAGING_CONTAINER = 'ridesense-staging'
        PRODUCTION_CONTAINER = 'ridesense-production'

        STAGING_PORT = '3101'
        PRODUCTION_PORT = '3000'

        SONAR_HOST_URL = 'http://localhost:9000'

        ALERTMANAGER_CONTAINER = 'ridesense-alertmanager'
        PROMETHEUS_CONTAINER = 'ridesense-prometheus'
        DISCORD_ADAPTER_CONTAINER = 'ridesense-discord-alerts'
    }

    stages {

        stage('Build') {

            steps {

                echo '========================================'
                echo 'STAGE 1 - BUILD'
                echo '========================================'

                bat '''
                echo Installing project dependencies...

                call npm ci

                if errorlevel 1 (
                    echo Dependency installation FAILED.
                    exit /b 1
                )

                echo.
                echo Building RideSense Docker image...

                docker build ^
                    -t %IMAGE_NAME%:build-%BUILD_NUMBER% ^
                    .

                if errorlevel 1 (
                    echo Docker build FAILED.
                    exit /b 1
                )

                echo.
                echo RideSense build image created successfully.

                docker images %IMAGE_NAME%
                '''
            }
        }


        stage('Test') {

            steps {

                echo '========================================'
                echo 'STAGE 2 - AUTOMATED TESTING'
                echo '========================================'

                bat '''
                echo Running RideSense unit and integration tests...

                call npm test -- --runInBand

                if errorlevel 1 (
                    echo Automated tests FAILED.
                    exit /b 1
                )

                echo.
                echo Running coverage validation...

                call npm run test:coverage

                if errorlevel 1 (
                    echo Coverage validation FAILED.
                    exit /b 1
                )

                echo.
                echo Automated Test Gate PASSED
                '''
            }

            post {

                always {

                    archiveArtifacts(
                        artifacts: 'coverage/**/*',
                        allowEmptyArchive: true
                    )
                }
            }
        }


        stage('Code Quality') {

            steps {

                echo '========================================'
                echo 'STAGE 3 - SONARQUBE QUALITY ANALYSIS'
                echo '========================================'

                withCredentials([
                    string(
                        credentialsId: 'ridesense-sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {

                    bat '''
                    echo Running RideSense SonarQube analysis...

                    call npx sonarqube-scanner ^
                        -Dsonar.projectKey=ridesense-ai ^
                        -Dsonar.projectName="RideSense AI" ^
                        -Dsonar.host.url=%SONAR_HOST_URL% ^
                        -Dsonar.login=%SONAR_TOKEN% ^
                        -Dsonar.sources=src ^
                        -Dsonar.tests=tests ^
                        -Dsonar.test.inclusions=tests/**/*.test.js ^
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info ^
                        -Dsonar.qualitygate.wait=true

                    if errorlevel 1 (
                        echo SonarQube Quality Gate FAILED.
                        exit /b 1
                    )

                    echo.
                    echo SonarQube analysis completed successfully.
                    echo SonarQube Quality Gate PASSED
                    '''
                }
            }
        }


        stage('Security') {

            steps {

                echo '========================================'
                echo 'STAGE 4 - SECURITY SCANNING'
                echo '========================================'

                bat '''
                echo Checking production npm dependencies...

                call npm audit --omit=dev --audit-level=high

                if errorlevel 1 (
                    echo Production dependency security gate FAILED.
                    exit /b 1
                )

                echo.
                echo Scanning Docker image with Trivy...

                trivy image ^
                    --scanners vuln ^
                    --severity HIGH,CRITICAL ^
                    --exit-code 1 ^
                    %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 (
                    echo Trivy security gate FAILED.
                    exit /b 1
                )

                echo.
                echo Security Gate PASSED
                '''
            }
        }


        stage('Deploy') {

            steps {

                echo '========================================'
                echo 'STAGE 5 - STAGING DEPLOYMENT'
                echo '========================================'

                bat '''
                echo Removing previous RideSense staging container...

                docker rm -f %STAGING_CONTAINER% 2>nul || echo No previous staging container found.

                echo.
                echo Deploying current build to staging...

                docker run -d ^
                    --name %STAGING_CONTAINER% ^
                    -p %STAGING_PORT%:3000 ^
                    %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 (
                    echo Staging Docker deployment FAILED.
                    exit /b 1
                )
                '''

                powershell '''
                    Write-Host "Waiting for RideSense staging startup..."

                    Start-Sleep -Seconds 6

                    try {

                        $response =
                            Invoke-RestMethod `
                                -Uri "http://localhost:3101/health" `
                                -Method Get `
                                -TimeoutSec 10

                        Write-Host "Staging Status: $($response.status)"
                        Write-Host "Staging Service: $($response.service)"

                        if ($response.status -ne "healthy") {
                            throw "Staging service returned unhealthy status."
                        }

                        Write-Host "Staging Deployment PASSED"

                    }
                    catch {

                        Write-Host "Staging health check FAILED."
                        Write-Host $_

                        exit 1
                    }
                '''
            }
        }


        stage('Release') {

            steps {

                echo '========================================'
                echo 'STAGE 6 - PRODUCTION RELEASE'
                echo '========================================'

                script {

                    try {

                        bat '''
                        echo Creating versioned RideSense release...

                        docker tag ^
                            %IMAGE_NAME%:build-%BUILD_NUMBER% ^
                            %IMAGE_NAME%:release-%BUILD_NUMBER%

                        if errorlevel 1 exit /b 1


                        echo.
                        echo Checking existing production deployment...

                        docker inspect %PRODUCTION_CONTAINER% >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (

                            echo Existing production deployment found.

                            for /F %%i in ('docker inspect -f "{{.Image}}" %PRODUCTION_CONTAINER%') do (

                                echo Preserving production image for rollback...

                                docker tag ^
                                    %%i ^
                                    %IMAGE_NAME%:rollback
                            )

                            docker rm -f %PRODUCTION_CONTAINER%

                        ) else (

                            echo No existing production deployment found.
                        )


                        echo.
                        echo Starting new RideSense production release...

                        docker run -d ^
                            --name %PRODUCTION_CONTAINER% ^
                            -p %PRODUCTION_PORT%:3000 ^
                            %IMAGE_NAME%:release-%BUILD_NUMBER%

                        if errorlevel 1 exit /b 1
                        '''


                        powershell '''
                            Write-Host "Waiting for production startup..."

                            Start-Sleep -Seconds 5

                            try {

                                $response =
                                    Invoke-RestMethod `
                                        -Uri "http://localhost:3000/health" `
                                        -Method Get `
                                        -TimeoutSec 10

                                Write-Host "Production Status: $($response.status)"
                                Write-Host "Production Service: $($response.service)"

                                if ($response.status -ne "healthy") {
                                    throw "Production health validation failed."
                                }

                            }
                            catch {

                                Write-Host "Production validation FAILED."

                                exit 1
                            }
                        '''


                        bat '''
                        echo.
                        echo Production health validation PASSED.

                        docker tag ^
                            %IMAGE_NAME%:release-%BUILD_NUMBER% ^
                            %IMAGE_NAME%:latest

                        echo release-%BUILD_NUMBER% > release-info.txt
                        '''


                        withCredentials([
                            usernamePassword(
                                credentialsId: 'ridesense-github-credentials',
                                usernameVariable: 'GITHUB_USER',
                                passwordVariable: 'GITHUB_TOKEN'
                            )
                        ]) {

                            bat '''
                            echo.
                            echo ========================================
                            echo Creating Git release tag
                            echo ========================================

                            git config user.name "RideSense Jenkins"
                            git config user.email "jenkins@ridesense.local"

                            git tag -a v1.0.%BUILD_NUMBER% ^
                                -m "RideSense production release v1.0.%BUILD_NUMBER%"

                            if errorlevel 1 (
                                echo Git tag creation FAILED.
                                exit /b 1
                            )

                            echo.
                            echo Pushing Git release tag to GitHub...

                            git push ^
                                https://%GITHUB_USER%:%GITHUB_TOKEN%@github.com/Kanishkar2903/ridesense-ai-devops.git ^
                                v1.0.%BUILD_NUMBER%

                            if errorlevel 1 (
                                echo Git release tag push FAILED.
                                exit /b 1
                            )

                            echo.
                            echo Git tag v1.0.%BUILD_NUMBER% successfully published.
                            '''
                        }


                        echo "RideSense production release completed successfully."

                    }
                    catch (Exception releaseError) {

                        echo 'Production release FAILED.'
                        echo 'Attempting automatic rollback...'

                        bat '''
                        docker rm -f %PRODUCTION_CONTAINER% 2>nul || echo Failed production container already removed.

                        docker image inspect %IMAGE_NAME%:rollback >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (

                            echo Rollback image found.
                            echo Restoring previous RideSense production release...

                            docker run -d ^
                                --name %PRODUCTION_CONTAINER% ^
                                -p %PRODUCTION_PORT%:3000 ^
                                %IMAGE_NAME%:rollback

                            if errorlevel 1 (
                                echo AUTOMATIC ROLLBACK FAILED.
                                exit /b 1
                            )

                            echo Previous production version restored.

                        ) else (

                            echo No rollback image is available.
                        )
                        '''

                        error(
                            "Production release failed. Rollback procedure executed."
                        )
                    }
                }
            }

            post {

                always {

                    archiveArtifacts(
                        artifacts: 'release-info.txt',
                        allowEmptyArchive: true
                    )
                }
            }
        }


        stage('Monitoring') {

            steps {

                echo '========================================'
                echo 'STAGE 7 - PROMETHEUS MONITORING'
                echo '========================================'

                withCredentials([
                    string(
                        credentialsId: 'discord-webhook',
                        variable: 'DISCORD_WEBHOOK_URL'
                    )
                ]) {

                    powershell '''
                        Write-Host "Configuring RideSense monitoring stack..."

                        docker rm -f ridesense-prometheus 2>$null
                        docker rm -f ridesense-alertmanager 2>$null
                        docker rm -f ridesense-discord-alerts 2>$null


                        $envFile =
                            Join-Path $env:WORKSPACE ".discord.env"

                        Set-Content `
                            -Path $envFile `
                            -Value ("DISCORD_WEBHOOK_URL=" + $env:DISCORD_WEBHOOK_URL) `
                            -NoNewline


                        try {

                            Write-Host "Starting Discord alert adapter..."

                            docker run -d `
                                --name ridesense-discord-alerts `
                                -p 9094:9094 `
                                --env-file $envFile `
                                --mount "type=bind,source=$env:WORKSPACE\\monitoring,target=/app/monitoring,readonly" `
                                node:24-alpine `
                                node /app/monitoring/discord-alerts.js

                            if ($LASTEXITCODE -ne 0) {
                                throw "Discord alert adapter failed to start."
                            }


                            Write-Host "Starting Prometheus Alertmanager..."

                            docker run -d `
                                --name ridesense-alertmanager `
                                -p 9093:9093 `
                                --mount "type=bind,source=$env:WORKSPACE\\monitoring\\alertmanager.yml,target=/etc/alertmanager/alertmanager.yml,readonly" `
                                prom/alertmanager:latest `
                                --config.file=/etc/alertmanager/alertmanager.yml

                            if ($LASTEXITCODE -ne 0) {
                                throw "Alertmanager failed to start."
                            }


                            Write-Host "Starting Prometheus..."

                            docker run -d `
                                --name ridesense-prometheus `
                                -p 9090:9090 `
                                --mount "type=bind,source=$env:WORKSPACE\\monitoring\\prometheus.yml,target=/etc/prometheus/prometheus.yml,readonly" `
                                --mount "type=bind,source=$env:WORKSPACE\\monitoring\\alert_rules.yml,target=/etc/prometheus/alert_rules.yml,readonly" `
                                prom/prometheus:latest `
                                --config.file=/etc/prometheus/prometheus.yml

                            if ($LASTEXITCODE -ne 0) {
                                throw "Prometheus failed to start."
                            }

                        }
                        finally {

                            if (Test-Path $envFile) {
                                Remove-Item $envFile -Force
                            }
                        }


                        Write-Host ""
                        Write-Host "Waiting for monitoring services..."

                        Start-Sleep -Seconds 10


                        try {

                            $discord =
                                Invoke-RestMethod `
                                    -Uri "http://localhost:9094/health" `
                                    -Method Get `
                                    -TimeoutSec 10

                            Write-Host "Discord Adapter Status: $($discord.status)"

                            if ($discord.status -ne "healthy") {
                                throw "Discord adapter is unhealthy."
                            }

                        }
                        catch {

                            Write-Host "Discord alert adapter validation FAILED."

                            exit 1
                        }


                        try {

                            $alertmanager =
                                Invoke-WebRequest `
                                    -Uri "http://localhost:9093/-/ready" `
                                    -UseBasicParsing `
                                    -TimeoutSec 10

                            Write-Host "Alertmanager HTTP Status: $($alertmanager.StatusCode)"

                            if ($alertmanager.StatusCode -ne 200) {
                                throw "Alertmanager is not ready."
                            }

                        }
                        catch {

                            Write-Host "Alertmanager validation FAILED."

                            exit 1
                        }


                        Write-Host ""
                        Write-Host "Checking production health..."

                        try {

                            $health =
                                Invoke-RestMethod `
                                    -Uri "http://localhost:3000/health" `
                                    -Method Get `
                                    -TimeoutSec 10

                            Write-Host "RideSense Health: $($health.status)"

                            if ($health.status -ne "healthy") {
                                throw "Production is unhealthy."
                            }

                        }
                        catch {

                            Write-Host "Production health monitoring FAILED."

                            exit 1
                        }


                        Write-Host ""
                        Write-Host "Checking RideSense metrics endpoint..."

                        try {

                            $metrics =
                                Invoke-WebRequest `
                                    -Uri "http://localhost:3000/metrics" `
                                    -UseBasicParsing `
                                    -TimeoutSec 10

                            Write-Host "Metrics HTTP Status: $($metrics.StatusCode)"

                            if ($metrics.StatusCode -ne 200) {
                                throw "Metrics endpoint failed."
                            }

                        }
                        catch {

                            Write-Host "Metrics validation FAILED."

                            exit 1
                        }


                        Write-Host ""
                        Write-Host "Waiting for Prometheus scrape..."

                        Start-Sleep -Seconds 8

                        try {

                            $query =
                                Invoke-RestMethod `
                                    -Uri "http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22ridesense-ai%22%7D" `
                                    -Method Get `
                                    -TimeoutSec 10

                            if ($query.data.result.Count -eq 0) {
                                throw "Prometheus did not return the RideSense target."
                            }

                            $upValue =
                                $query.data.result[0].value[1]

                            Write-Host "Prometheus RideSense UP Value: $upValue"

                            if ($upValue -ne "1") {
                                throw "Prometheus reports RideSense as DOWN."
                            }

                            Write-Host "Prometheus Monitoring Gate PASSED"

                        }
                        catch {

                            Write-Host "Prometheus monitoring validation FAILED."

                            exit 1
                        }
                    '''
                }
            }
        }
    }


    post {

        success {

            echo "RideSense Jenkins Build Number: ${BUILD_NUMBER}"

            echo '========================================'
            echo 'RIDESENSE CI/CD PIPELINE SUCCESSFUL'
            echo '========================================'

            echo 'Build        : PASSED'
            echo 'Test         : PASSED'
            echo 'Code Quality : PASSED'
            echo 'Security     : PASSED'
            echo 'Deploy       : PASSED'
            echo 'Release      : PASSED'
            echo 'Monitoring   : PASSED'

            echo "Docker Release : ridesense-ai:release-${BUILD_NUMBER}"
            echo "Git Release    : v1.0.${BUILD_NUMBER}"


            withCredentials([
                string(
                    credentialsId: 'discord-webhook',
                    variable: 'DISCORD_WEBHOOK_URL'
                )
            ]) {

                powershell '''
                    $message = @"
✅ **RideSense CI/CD Build Successful**

Status: SUCCESS

Build Number: #$env:BUILD_NUMBER
Job: $env:JOB_NAME

Build: PASSED
Test: PASSED
Code Quality: PASSED
Security: PASSED
Deploy: PASSED
Release: PASSED
Monitoring: PASSED

Docker Release: ridesense-ai:release-$env:BUILD_NUMBER
Git Release: v1.0.$env:BUILD_NUMBER

Service: RideSense AI
"@

                    $payload = @{
                        username = "RideSense Jenkins"
                        content = $message
                        allowed_mentions = @{
                            parse = @()
                        }
                    } | ConvertTo-Json -Depth 5

                    try {

                        Invoke-RestMethod `
                            -Uri $env:DISCORD_WEBHOOK_URL `
                            -Method Post `
                            -ContentType "application/json" `
                            -Body $payload

                        Write-Host "Discord SUCCESS notification sent."

                    }
                    catch {

                        Write-Host "Warning: Discord SUCCESS notification failed."
                        Write-Host $_
                    }
                '''
            }
        }


        failure {

            echo '========================================'
            echo 'RIDESENSE CI/CD PIPELINE FAILED'
            echo '========================================'

            echo 'Review the failed stage in the Jenkins console output.'


            withCredentials([
                string(
                    credentialsId: 'discord-webhook',
                    variable: 'DISCORD_WEBHOOK_URL'
                )
            ]) {

                powershell '''
                    $message = @"
❌ **RideSense CI/CD Build Failed**

Status: FAILURE

Build Number: #$env:BUILD_NUMBER
Job: $env:JOB_NAME

A stage in the RideSense CI/CD pipeline failed.

Jenkins performed all configured safety and rollback procedures where applicable.

Please review the Jenkins console output for the failed stage.

Service: RideSense AI
"@

                    $payload = @{
                        username = "RideSense Jenkins"
                        content = $message
                        allowed_mentions = @{
                            parse = @()
                        }
                    } | ConvertTo-Json -Depth 5

                    try {

                        Invoke-RestMethod `
                            -Uri $env:DISCORD_WEBHOOK_URL `
                            -Method Post `
                            -ContentType "application/json" `
                            -Body $payload

                        Write-Host "Discord FAILURE notification sent."

                    }
                    catch {

                        Write-Host "Warning: Discord FAILURE notification failed."
                        Write-Host $_
                    }
                '''
            }
        }


        always {

            bat '''
            if exist .discord.env (
                del /F /Q .discord.env
            )
            '''
        }
    }
}