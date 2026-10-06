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
                npm ci

                echo Building versioned RideSense Docker image...
                docker build --no-cache -t %IMAGE_NAME%:build-%BUILD_NUMBER% .

                echo Docker image created:
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
                npm test -- --runInBand

                echo Running coverage gate...
                npm run test:coverage -- --runInBand
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
                    echo Running SonarQube analysis...
                    npm run sonar -- -Dsonar.host.url=%SONAR_HOST_URL%
                    '''

                    bat '''
                    echo Waiting for SonarQube analysis processing...
                    powershell -NoProfile -Command "Start-Sleep -Seconds 8"

                    echo Checking SonarQube Quality Gate...

                    powershell -NoProfile -Command ^
                    "$bytes = [System.Text.Encoding]::ASCII.GetBytes($env:SONAR_TOKEN + ':'); ^
                    $auth = [Convert]::ToBase64String($bytes); ^
                    $headers = @{ Authorization = 'Basic ' + $auth }; ^
                    $url = 'http://localhost:9000/api/qualitygates/project_status?projectKey=ridesense-ai'; ^
                    $result = Invoke-RestMethod -Uri $url -Headers $headers; ^
                    Write-Host ('Quality Gate Status: ' + $result.projectStatus.status); ^
                    if ($result.projectStatus.status -ne 'OK') { ^
                        Write-Host 'SonarQube Quality Gate FAILED'; ^
                        exit 1 ^
                    } else { ^
                        Write-Host 'SonarQube Quality Gate PASSED' ^
                    }"
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
                npm audit --omit=dev --audit-level=high

                echo.
                echo Running Trivy HIGH and CRITICAL vulnerability gate...
                trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 %IMAGE_NAME%:build-%BUILD_NUMBER%

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
                echo Removing previous staging container if present...
                docker rm -f %STAGING_CONTAINER% 2>nul || echo No previous staging container found.

                echo Deploying RideSense to staging...
                docker run -d ^
                  --name %STAGING_CONTAINER% ^
                  -p %STAGING_PORT%:3000 ^
                  %IMAGE_NAME%:build-%BUILD_NUMBER%

                echo Waiting for staging service...
                powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                echo Checking staging health...
                powershell -NoProfile -Command ^
                "$response = Invoke-RestMethod -Uri 'http://localhost:3101/health'; ^
                Write-Host ('Staging Status: ' + $response.status); ^
                if ($response.status -ne 'healthy') { exit 1 }"

                echo Staging deployment PASSED
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

                    // Preserve the currently running production image
                    // so Jenkins can automatically roll back if needed.
                    bat '''
                    echo Checking for an existing production deployment...

                    for /f %%i in ('docker inspect -f "{{.Image}}" %PRODUCTION_CONTAINER% 2^>nul') do (
                        echo Preserving current production image for rollback...
                        docker tag %%i %IMAGE_NAME%:rollback
                    )

                    echo Creating versioned release image...
                    docker tag %IMAGE_NAME%:build-%BUILD_NUMBER% %IMAGE_NAME%:release-%BUILD_NUMBER%

                    echo Removing current production container...
                    docker rm -f %PRODUCTION_CONTAINER% 2>nul || echo No previous production container found.

                    echo Starting new production release...
                    docker run -d ^
                      --name %PRODUCTION_CONTAINER% ^
                      -p %PRODUCTION_PORT%:3000 ^
                      %IMAGE_NAME%:release-%BUILD_NUMBER%
                    '''

                    try {

                        bat '''
                        echo Waiting for new production release...
                        powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                        echo Running production health check...
                        powershell -NoProfile -Command ^
                        "$response = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                        Write-Host ('Production Status: ' + $response.status); ^
                        Write-Host ('Production Service: ' + $response.service); ^
                        if ($response.status -ne 'healthy') { exit 1 }"

                        echo Production release passed health validation.

                        echo Tagging successful production release as latest...
                        docker tag %IMAGE_NAME%:release-%BUILD_NUMBER% %IMAGE_NAME%:latest

                        echo release-%BUILD_NUMBER% > release-info.txt
                        '''

                    } catch (err) {

                        echo 'Production health check FAILED.'
                        echo 'Automatic rollback is being attempted.'

                        bat '''
                        docker rm -f %PRODUCTION_CONTAINER% 2>nul || echo Failed production container already removed.

                        docker image inspect %IMAGE_NAME%:rollback >nul 2>&1

                        if %ERRORLEVEL% EQU 0 (
                            echo Rollback image found.
                            echo Restoring previous production version...

                            docker run -d ^
                              --name %PRODUCTION_CONTAINER% ^
                              -p %PRODUCTION_PORT%:3000 ^
                              %IMAGE_NAME%:rollback

                            powershell -NoProfile -Command "Start-Sleep -Seconds 5"

                            powershell -NoProfile -Command ^
                            "$response = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                            Write-Host ('Rollback Status: ' + $response.status)"
                        ) else (
                            echo No previous rollback image is available.
                        )
                        '''

                        error('Production release failed. Rollback procedure executed.')
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
                echo Checking production health endpoint...

                powershell -NoProfile -Command ^
                "$health = Invoke-RestMethod -Uri 'http://localhost:3000/health'; ^
                Write-Host ('RideSense Health: ' + $health.status); ^
                if ($health.status -ne 'healthy') { exit 1 }"

                echo.
                echo Checking RideSense metrics endpoint...

                powershell -NoProfile -Command ^
                "$metrics = Invoke-WebRequest -Uri 'http://localhost:3000/metrics' -UseBasicParsing; ^
                Write-Host ('Metrics HTTP Status: ' + $metrics.StatusCode); ^
                if ($metrics.StatusCode -ne 200) { exit 1 }"

                echo.
                echo Waiting for Prometheus to scrape production...
                powershell -NoProfile -Command "Start-Sleep -Seconds 8"

                echo.
                echo Checking Prometheus RideSense target...

                powershell -NoProfile -Command ^
                "$url = 'http://localhost:9090/api/v1/query?query=up%%7Bjob%%3D%%22ridesense-ai%%22%%7D'; ^
                $result = Invoke-RestMethod -Uri $url; ^
                if ($result.data.result.Count -eq 0) { ^
                    Write-Host 'RideSense target was not found in Prometheus'; ^
                    exit 1 ^
                }; ^
                $value = $result.data.result[0].value[1]; ^
                Write-Host ('Prometheus RideSense UP value: ' + $value); ^
                if ($value -ne '1') { ^
                    Write-Host 'Prometheus monitoring check FAILED'; ^
                    exit 1 ^
                }; ^
                Write-Host 'Prometheus monitoring check PASSED'"
                '''
            }
        }
    }

    post {

        success {
            echo '========================================'
            echo 'RIDESENSE CI/CD PIPELINE SUCCESSFUL'
            echo '========================================'
            echo 'Build       : PASSED'
            echo 'Tests       : PASSED'
            echo 'Code Quality: PASSED'
            echo 'Security    : PASSED'
            echo 'Deploy      : PASSED'
            echo 'Release     : PASSED'
            echo 'Monitoring  : PASSED'
        }

        failure {
            echo '========================================'
            echo 'RIDESENSE CI/CD PIPELINE FAILED'
            echo '========================================'
            echo 'Review the failed Jenkins stage and console output.'
        }

        always {
            echo "RideSense Jenkins Build: ${BUILD_NUMBER}"
        }
    }
}