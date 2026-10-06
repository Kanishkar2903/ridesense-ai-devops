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
                docker build --no-cache -t %IMAGE_NAME%:build-%BUILD_NUMBER% .

                if errorlevel 1 exit /b 1

                echo.
                echo Docker image created successfully:
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
                echo Running test coverage gate...
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
                      -Dsonar.host.url=%SONAR_HOST_URL% ^
                      -Dsonar.login=%SONAR_TOKEN%

                    if errorlevel 1 exit /b 1
                    '''

                    bat '''
                    echo.
                    echo Waiting for SonarQube processing...
                    powershell -NoProfile -Command "Start-Sleep -Seconds 8"

                    echo.
                    echo Checking SonarQube Quality Gate...

                    powershell -NoProfile -Command ^
                    "$bytes = [System.Text.Encoding]::ASCII.GetBytes($env:SONAR_TOKEN + ':'); ^
                    $auth = [Convert]::ToBase64String($bytes); ^
                    $headers = @{ Authorization = 'Basic ' + $auth }; ^
                    $url = 'http://localhost:9000/api/qualitygates/project_status?projectKey=ridesense-ai'; ^
                    $result = Invoke-RestMethod -Uri $url -Headers $headers; ^
                    $status = $result.projectStatus.status; ^
                    Write-Host ('Quality Gate Status: ' + $status); ^
                    if ($status -ne 'OK') { ^
                        Write-Host 'SonarQube Quality Gate FAILED'; ^
                        exit 1 ^
                    }; ^
                    Write-Host 'SonarQube Quality Gate PASSED'"
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
                echo 'STAGE 4 - SECURITY'
                echo '========================================'

                bat '''
                echo Running production dependency audit...
                call npm audit --omit=dev --audit-level=high

                if errorlevel 1 exit /b 1

                echo.
                echo Running Trivy HIGH / CRITICAL image scan...

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
                echo Removing previous staging container...
                docker rm -f %STAGING_CONTAINER% 2>nul

                echo.
                echo Deploying build-%BUILD_NUMBER% to staging...

                docker run -d ^
                  --name %STAGING_CONTAINER% ^
                  -p %STAGING_PORT%:3000 ^
                  %IMAGE_NAME%:build-%BUILD_NUMBER%

                if errorlevel 1 exit /b 1

                echo.
                echo Waiting for staging startup...
                powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                echo.
                echo Performing staging health check...

                powershell -NoProfile -Command ^
                "$response = Invoke-RestMethod -Uri 'http://localhost:3101/health'; ^
                Write-Host ('Staging Status: ' + $response.status); ^
                Write-Host ('Staging Service: ' + $response.service); ^
                if ($response.status -ne 'healthy') { exit 1 }"

                if errorlevel 1 exit /b 1

                echo.
                echo Staging Deployment PASSED
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
                    echo Creating release image...
                    docker tag ^
                      %IMAGE_NAME%:build-%BUILD_NUMBER% ^
                      %IMAGE_NAME%:release-%BUILD_NUMBER%

                    if errorlevel 1 exit /b 1

                    echo.
                    echo Checking current production deployment...

                    docker inspect %PRODUCTION_CONTAINER% >nul 2>&1

                    if %ERRORLEVEL% EQU 0 (
                        echo Existing production container detected.

                        for /f %%i in ('docker inspect -f "{{.Image}}" %PRODUCTION_CONTAINER%') do (
                            echo Saving previous production image as rollback...
                            docker tag %%i %IMAGE_NAME%:rollback
                        )

                        docker rm -f %PRODUCTION_CONTAINER%
                    ) else (
                        echo No previous production container exists.
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

                        bat '''
                        echo.
                        echo Waiting for production startup...
                        powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                        echo.
                        echo Performing production health check...

                        powershell -NoProfile -Command ^
                        "$response = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                        Write-Host ('Production Status: ' + $response.status); ^
                        Write-Host ('Production Service: ' + $response.service); ^
                        if ($response.status -ne 'healthy') { exit 1 }"

                        if errorlevel 1 exit /b 1

                        echo.
                        echo Production health validation PASSED.

                        docker tag ^
                          %IMAGE_NAME%:release-%BUILD_NUMBER% ^
                          %IMAGE_NAME%:latest

                        echo release-%BUILD_NUMBER% > release-info.txt
                        '''

                    } catch (err) {

                        echo 'Production deployment failed.'
                        echo 'Starting automatic rollback procedure.'

                        bat '''
                        docker rm -f %PRODUCTION_CONTAINER% 2>nul

                        echo Checking rollback image...

                        docker image inspect %IMAGE_NAME%:rollback >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (
                            echo Rollback image found.

                            docker run -d ^
                              --name %PRODUCTION_CONTAINER% ^
                              -p %PRODUCTION_PORT%:3000 ^
                              %IMAGE_NAME%:rollback

                            powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                            powershell -NoProfile -Command ^
                            "$response = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                            Write-Host ('Rollback Status: ' + $response.status); ^
                            if ($response.status -ne 'healthy') { exit 1 }"

                        ) else (
                            echo WARNING: No rollback image exists because this may be the first production deployment.
                        )
                        '''

                        error('Production release failed. Automatic rollback procedure executed.')
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

                bat '''
                echo Checking production health...

                powershell -NoProfile -Command ^
                "$health = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                Write-Host ('RideSense Production Health: ' + $health.status); ^
                if ($health.status -ne 'healthy') { exit 1 }"

                if errorlevel 1 exit /b 1

                echo.
                echo Checking RideSense Prometheus metrics endpoint...

                powershell -NoProfile -Command ^
                "$response = Invoke-WebRequest -Uri 'http://localhost:3000/metrics' -UseBasicParsing; ^
                Write-Host ('Metrics HTTP Status: ' + $response.StatusCode); ^
                if ($response.StatusCode -ne 200) { exit 1 }"

                if errorlevel 1 exit /b 1

                echo.
                echo Waiting for Prometheus scrape...
                powershell -NoProfile -Command "Start-Sleep -Seconds 8"

                echo.
                echo Querying Prometheus target...

                powershell -NoProfile -Command ^
                "$url = 'http://localhost:9090/api/v1/query?query=up%%7Bjob%%3D%%22ridesense-ai%%22%%7D'; ^
                $result = Invoke-RestMethod -Uri $url; ^
                if ($result.status -ne 'success') { ^
                    Write-Host 'Prometheus query failed'; ^
                    exit 1 ^
                }; ^
                if ($result.data.result.Count -eq 0) { ^
                    Write-Host 'RideSense target was not found in Prometheus'; ^
                    exit 1 ^
                }; ^
                $value = $result.data.result[0].value[1]; ^
                Write-Host ('Prometheus RideSense UP Value: ' + $value); ^
                if ($value -ne '1') { ^
                    Write-Host 'Prometheus Monitoring Gate FAILED'; ^
                    exit 1 ^
                }; ^
                Write-Host 'Prometheus Monitoring Gate PASSED'"

                if errorlevel 1 exit /b 1
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
            echo 'Check the failed Jenkins stage above.'
        }

        always {
            echo "RideSense Jenkins Build Number: ${BUILD_NUMBER}"
        }
    }
}