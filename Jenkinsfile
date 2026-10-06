pipeline {
    agent any

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
        PROMETHEUS_URL = 'http://localhost:9090'
    }

    stages {

        // ============================================================
        // 1. BUILD
        // ============================================================
        stage('Build') {
            steps {
                echo '========================================'
                echo 'STAGE 1 - BUILD'
                echo '========================================'

                bat '''
                echo Installing Node.js dependencies...
                call npm ci

                if errorlevel 1 exit /b 1

                echo.
                echo Building versioned RideSense Docker image...

                docker build --no-cache ^
                  -t %IMAGE_NAME%:build-%BUILD_NUMBER% .

                if errorlevel 1 exit /b 1

                echo.
                echo Docker image created successfully.

                docker images %IMAGE_NAME%
                '''
            }
        }

        // ============================================================
        // 2. TEST
        // ============================================================
        stage('Test') {
            steps {
                echo '========================================'
                echo 'STAGE 2 - AUTOMATED TESTING'
                echo '========================================'

                bat '''
                echo Running unit and integration tests...

                call npm test -- --runInBand

                if errorlevel 1 exit /b 1

                echo.
                echo Running coverage gate...

                call npm run test:coverage -- --runInBand

                if errorlevel 1 exit /b 1

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

        // ============================================================
        // 3. CODE QUALITY
        // ============================================================
        stage('Code Quality') {
            steps {
                echo '========================================'
                echo 'STAGE 3 - SONARQUBE CODE QUALITY'
                echo '========================================'

                withCredentials([
                    string(
                        credentialsId: 'ridesense-sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {

                    bat '''
                    echo Running authenticated SonarQube analysis...

                    call npm run sonar -- ^
                      -Dsonar.host.url=%SONAR_HOST_URL%

                    if errorlevel 1 exit /b 1
                    '''

                    powershell '''
                    Write-Host ""
                    Write-Host "Checking SonarQube analysis processing..."

                    $tokenBytes =
                        [System.Text.Encoding]::ASCII.GetBytes(
                            $env:SONAR_TOKEN + ":"
                        )

                    $encodedToken =
                        [Convert]::ToBase64String($tokenBytes)

                    $headers = @{
                        Authorization = "Basic $encodedToken"
                    }

                    $reportFile =
                        ".scannerwork/report-task.txt"

                    if (-not (Test-Path $reportFile)) {
                        Write-Host "SonarQube report-task.txt was not found."
                        exit 1
                    }

                    $report =
                        Get-Content $reportFile

                    $ceTaskLine =
                        $report |
                        Where-Object {
                            $_ -like "ceTaskUrl=*"
                        }

                    if (-not $ceTaskLine) {
                        Write-Host "SonarQube CE task URL was not found."
                        exit 1
                    }

                    $ceTaskUrl =
                        $ceTaskLine.Substring(
                            "ceTaskUrl=".Length
                        )

                    Write-Host "Waiting for SonarQube processing..."

                    $analysisId = $null

                    for ($attempt = 1; $attempt -le 20; $attempt++) {

                        $taskResult =
                            Invoke-RestMethod `
                                -Uri $ceTaskUrl `
                                -Headers $headers

                        $taskStatus =
                            $taskResult.task.status

                        Write-Host (
                            "SonarQube processing status: " +
                            $taskStatus
                        )

                        if ($taskStatus -eq "SUCCESS") {

                            $analysisId =
                                $taskResult.task.analysisId

                            break
                        }

                        if (
                            $taskStatus -eq "FAILED" -or
                            $taskStatus -eq "CANCELED"
                        ) {
                            Write-Host (
                                "SonarQube analysis processing failed."
                            )

                            exit 1
                        }

                        Start-Sleep -Seconds 3
                    }

                    if (-not $analysisId) {
                        Write-Host (
                            "Timed out waiting for SonarQube analysis."
                        )

                        exit 1
                    }

                    Write-Host ""
                    Write-Host "Checking SonarQube Quality Gate..."

                    $qualityGateUrl =
                        "$env:SONAR_HOST_URL" +
                        "/api/qualitygates/project_status" +
                        "?analysisId=$analysisId"

                    $qualityGate =
                        Invoke-RestMethod `
                            -Uri $qualityGateUrl `
                            -Headers $headers

                    $qualityStatus =
                        $qualityGate.projectStatus.status

                    Write-Host (
                        "Quality Gate Status: " +
                        $qualityStatus
                    )

                    if ($qualityStatus -ne "OK") {

                        Write-Host (
                            "SonarQube Quality Gate FAILED"
                        )

                        exit 1
                    }

                    Write-Host (
                        "SonarQube Quality Gate PASSED"
                    )
                    '''
                }
            }
        }

        // ============================================================
        // 4. SECURITY
        // ============================================================
        stage('Security') {
            steps {
                echo '========================================'
                echo 'STAGE 4 - SECURITY SCANNING'
                echo '========================================'

                bat '''
                echo Checking production dependencies...

                call npm audit --omit=dev --audit-level=high

                if errorlevel 1 exit /b 1

                echo.
                echo Running Trivy HIGH and CRITICAL gate...

                trivy image ^
                  --scanners vuln ^
                  --severity HIGH,CRITICAL ^
                  --exit-code 1 ^
                  %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 exit /b 1

                echo.
                echo Security Gate PASSED
                '''
            }
        }

        // ============================================================
        // 5. DEPLOY
        // ============================================================
        stage('Deploy') {
            steps {
                echo '========================================'
                echo 'STAGE 5 - STAGING DEPLOYMENT'
                echo '========================================'

                bat '''
                echo Removing old staging container...

                docker rm -f %STAGING_CONTAINER% 2>nul || echo No previous staging container found.

                echo.
                echo Starting staging container...

                docker run -d ^
                  --name %STAGING_CONTAINER% ^
                  -p %STAGING_PORT%:3000 ^
                  %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 exit /b 1
                '''

                powershell '''
                Write-Host "Waiting for staging startup..."

                Start-Sleep -Seconds 5

                Write-Host "Checking staging health..."

                try {

                    $response =
                        Invoke-RestMethod `
                            -Uri "http://localhost:3101/health"

                    Write-Host (
                        "Staging Status: " +
                        $response.status
                    )

                    Write-Host (
                        "Staging Service: " +
                        $response.service
                    )

                    if ($response.status -ne "healthy") {
                        exit 1
                    }

                }
                catch {

                    Write-Host (
                        "Staging health check failed."
                    )

                    Write-Host $_

                    exit 1
                }

                Write-Host (
                    "Staging Deployment PASSED"
                )
                '''
            }
        }

        // ============================================================
        // 6. RELEASE
        // ============================================================
        stage('Release') {
            steps {
                echo '========================================'
                echo 'STAGE 6 - VERSIONED PRODUCTION RELEASE'
                echo '========================================'

                script {

                    bat '''
                    echo Creating versioned release image...

                    docker tag ^
                      %IMAGE_NAME%:build-%BUILD_NUMBER% ^
                      %IMAGE_NAME%:release-%BUILD_NUMBER%

                    if errorlevel 1 exit /b 1

                    echo.
                    echo Checking for existing production container...

                    docker inspect %PRODUCTION_CONTAINER% >nul 2>&1

                    if %ERRORLEVEL% EQU 0 (

                        echo Existing production deployment detected.

                        for /f %%i in ('docker inspect -f "{{.Image}}" %PRODUCTION_CONTAINER%') do (
                            echo Saving current production image for rollback...

                            docker tag ^
                              %%i ^
                              %IMAGE_NAME%:rollback
                        )

                        echo Removing current production container...

                        docker rm -f %PRODUCTION_CONTAINER%

                    ) else (

                        echo No existing production container found.

                    )

                    echo.
                    echo Starting new production release...

                    docker run -d ^
                      --name %PRODUCTION_CONTAINER% ^
                      -p %PRODUCTION_PORT%:3000 ^
                      %IMAGE_NAME%:release-%BUILD_NUMBER%

                    if errorlevel 1 exit /b 1
                    '''

                    try {

                        powershell '''
                        Write-Host (
                            "Waiting for production startup..."
                        )

                        Start-Sleep -Seconds 5

                        Write-Host (
                            "Checking production health..."
                        )

                        try {

                            $response =
                                Invoke-RestMethod `
                                    -Uri "http://localhost:3000/health"

                            Write-Host (
                                "Production Status: " +
                                $response.status
                            )

                            Write-Host (
                                "Production Service: " +
                                $response.service
                            )

                            if (
                                $response.status -ne
                                "healthy"
                            ) {
                                exit 1
                            }

                        }
                        catch {

                            Write-Host (
                                "Production health check failed."
                            )

                            exit 1
                        }
                        '''

                        bat '''
                        echo.
                        echo Production health validation PASSED.

                        echo Tagging successful release as latest...

                        docker tag ^
                          %IMAGE_NAME%:release-%BUILD_NUMBER% ^
                          %IMAGE_NAME%:latest

                        echo release-%BUILD_NUMBER% > release-info.txt
                        '''

                    }
                    catch (err) {

                        echo 'Production deployment failed.'
                        echo 'Starting automatic rollback.'

                        bat '''
                        docker rm -f %PRODUCTION_CONTAINER% 2>nul || echo Failed container already removed.

                        docker image inspect %IMAGE_NAME%:rollback >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (

                            echo Rollback image found.

                            docker run -d ^
                              --name %PRODUCTION_CONTAINER% ^
                              -p %PRODUCTION_PORT%:3000 ^
                              %IMAGE_NAME%:rollback

                        ) else (

                            echo No rollback image is available.

                        )
                        '''

                        powershell '''
                        $rollbackExists =
                            docker image inspect `
                                ridesense-ai:rollback `
                                2>$null

                        if ($LASTEXITCODE -eq 0) {

                            Write-Host (
                                "Waiting for rollback service..."
                            )

                            Start-Sleep -Seconds 5

                            try {

                                $response =
                                    Invoke-RestMethod `
                                        -Uri "http://localhost:3000/health"

                                Write-Host (
                                    "Rollback Status: " +
                                    $response.status
                                )

                            }
                            catch {

                                Write-Host (
                                    "Rollback health check failed."
                                )
                            }
                        }
                        '''

                        error(
                            'Production release failed. Rollback procedure executed.'
                        )
                    }
                }
            }

            post {
                success {
                    archiveArtifacts(
                        artifacts: 'release-info.txt',
                        allowEmptyArchive: true
                    )
                }
            }
        }

        // ============================================================
        // 7. MONITORING
        // ============================================================
        stage('Monitoring') {
            steps {
                echo '========================================'
                echo 'STAGE 7 - PROMETHEUS MONITORING'
                echo '========================================'

                powershell '''
                Write-Host (
                    "Checking production health endpoint..."
                )

                try {

                    $health =
                        Invoke-RestMethod `
                            -Uri "http://localhost:3000/health"

                    Write-Host (
                        "RideSense Health: " +
                        $health.status
                    )

                    if ($health.status -ne "healthy") {
                        exit 1
                    }

                }
                catch {

                    Write-Host (
                        "Production health endpoint failed."
                    )

                    exit 1
                }

                Write-Host ""
                Write-Host (
                    "Checking Prometheus metrics endpoint..."
                )

                try {

                    $metrics =
                        Invoke-WebRequest `
                            -Uri "http://localhost:3000/metrics" `
                            -UseBasicParsing

                    Write-Host (
                        "Metrics HTTP Status: " +
                        $metrics.StatusCode
                    )

                    if ($metrics.StatusCode -ne 200) {
                        exit 1
                    }

                }
                catch {

                    Write-Host (
                        "Metrics endpoint failed."
                    )

                    exit 1
                }

                Write-Host ""
                Write-Host (
                    "Waiting for Prometheus scrape..."
                )

                Start-Sleep -Seconds 8

                Write-Host ""
                Write-Host (
                    "Checking Prometheus RideSense target..."
                )

                $queryUrl =
                    "http://localhost:9090/api/v1/query" +
                    "?query=up%7Bjob%3D%22ridesense-ai%22%7D"

                try {

                    $result =
                        Invoke-RestMethod `
                            -Uri $queryUrl

                }
                catch {

                    Write-Host (
                        "Unable to query Prometheus."
                    )

                    exit 1
                }

                if ($result.status -ne "success") {

                    Write-Host (
                        "Prometheus query failed."
                    )

                    exit 1
                }

                if ($result.data.result.Count -eq 0) {

                    Write-Host (
                        "RideSense target was not found."
                    )

                    exit 1
                }

                $upValue =
                    $result.data.result[0].value[1]

                Write-Host (
                    "Prometheus RideSense UP Value: " +
                    $upValue
                )

                if ($upValue -ne "1") {

                    Write-Host (
                        "Prometheus Monitoring Gate FAILED"
                    )

                    exit 1
                }

                Write-Host (
                    "Prometheus Monitoring Gate PASSED"
                )
                '''
            }
        }
    }

    post {

        success {
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
        }

        failure {
            echo '========================================'
            echo 'RIDESENSE CI/CD PIPELINE FAILED'
            echo '========================================'
            echo 'Review the failed stage in Jenkins.'
        }

        always {
            echo "RideSense Jenkins Build Number: ${BUILD_NUMBER}"
        }
    }
}