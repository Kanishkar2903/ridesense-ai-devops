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
                echo Installing project dependencies...
                call npm ci

                if errorlevel 1 exit /b 1

                echo.
                echo Building RideSense Docker image...

                docker build --no-cache ^
                  -t %IMAGE_NAME%:build-%BUILD_NUMBER% .

                if errorlevel 1 exit /b 1

                echo.
                echo RideSense build image created successfully.

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
                echo Running RideSense unit and integration tests...

                call npm test -- --runInBand

                if errorlevel 1 exit /b 1

                echo.
                echo Running coverage validation...

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
                        echo.
                        echo SonarQube Quality Gate FAILED
                        exit /b 1
                    )

                    echo.
                    echo SonarQube analysis completed successfully.
                    echo SonarQube Quality Gate PASSED
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
                echo Checking production npm dependencies...

                call npm audit --omit=dev --audit-level=high

                if errorlevel 1 exit /b 1

                echo.
                echo Scanning Docker image with Trivy...

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
                echo Removing previous RideSense staging container...

                docker rm -f %STAGING_CONTAINER% 2>nul || echo No previous staging container found.

                echo.
                echo Deploying current build to staging...

                docker run -d ^
                  --name %STAGING_CONTAINER% ^
                  -p %STAGING_PORT%:3000 ^
                  %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 exit /b 1
                '''

                powershell '''
                Write-Host "Waiting for RideSense staging startup..."

                Start-Sleep -Seconds 5

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

                    Write-Host "Staging health validation failed."
                    exit 1
                }

                Write-Host "Staging Deployment PASSED"
                '''
            }
        }

        // ============================================================
        // 6. RELEASE
        // ============================================================
        stage('Release') {
            steps {
                echo '========================================'
                echo 'STAGE 6 - PRODUCTION RELEASE'
                echo '========================================'

                script {

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

                        for /f %%i in ('docker inspect -f "{{.Image}}" %PRODUCTION_CONTAINER%') do (

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

                    try {

                        powershell '''
                        Write-Host "Waiting for production startup..."

                        Start-Sleep -Seconds 5

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

                            if ($response.status -ne "healthy") {
                                exit 1
                            }

                        }
                        catch {

                            Write-Host "Production health validation failed."
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

                    }
                    catch (err) {

                        echo 'Production deployment failed.'
                        echo 'Executing RideSense rollback procedure.'

                        bat '''
                        docker rm -f %PRODUCTION_CONTAINER% 2>nul || echo Production container already removed.

                        docker image inspect %IMAGE_NAME%:rollback >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (

                            echo Rollback image available.

                            docker run -d ^
                              --name %PRODUCTION_CONTAINER% ^
                              -p %PRODUCTION_PORT%:3000 ^
                              %IMAGE_NAME%:rollback

                        ) else (

                            echo No previous rollback image is available.

                        )
                        '''

                        powershell '''
                        docker image inspect `
                            ridesense-ai:rollback `
                            2>$null |
                            Out-Null

                        if ($LASTEXITCODE -eq 0) {

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

                                Write-Host "Rollback health check failed."
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
                Write-Host "Checking production health..."

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

                    Write-Host "Production health endpoint failed."
                    exit 1
                }

                Write-Host ""
                Write-Host "Checking RideSense metrics endpoint..."

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

                    Write-Host "Metrics endpoint failed."
                    exit 1
                }

                Write-Host ""
                Write-Host "Waiting for Prometheus scrape..."

                Start-Sleep -Seconds 8

                $queryUrl =
                    "http://localhost:9090/api/v1/query" +
                    "?query=up%7Bjob%3D%22ridesense-ai%22%7D"

                try {

                    $result =
                        Invoke-RestMethod `
                            -Uri $queryUrl

                }
                catch {

                    Write-Host "Unable to communicate with Prometheus."
                    exit 1
                }

                if ($result.status -ne "success") {
                    Write-Host "Prometheus query failed."
                    exit 1
                }

                if ($result.data.result.Count -eq 0) {
                    Write-Host "RideSense target was not found in Prometheus."
                    exit 1
                }

                $upValue =
                    $result.data.result[0].value[1]

                Write-Host (
                    "Prometheus RideSense UP Value: " +
                    $upValue
                )

                if ($upValue -ne "1") {
                    Write-Host "Prometheus Monitoring Gate FAILED"
                    exit 1
                }

                Write-Host "Prometheus Monitoring Gate PASSED"
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
            echo 'Review the failed Jenkins stage.'
        }

        always {
            echo "RideSense Jenkins Build Number: ${BUILD_NUMBER}"
        }
    }
}