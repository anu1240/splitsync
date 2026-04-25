pipeline {
    agent any

    environment {
        EC2_IP            = '52.66.175.195'
        GIT_REPO_URL      = 'https://github.com/anu1240/splitsync.git'
        KEY_PATH          = credentials('EC2_SSH_KEY')
    }

    stages {

        stage('1. Checkout') {
            steps {
                echo '📥 Pulling latest code from GitHub...'
                checkout scm
            }
        }

        stage('2. Deploy via Ansible') {
            steps {
                echo '⚙️ Deploying to EC2 via Ansible...'
                sh """
                    export GIT_REPO_URL=${GIT_REPO_URL}
                    ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
                """
            }
        }

        stage('3. Health Check') {
            steps {
                echo '🏥 Verifying app is live...'
                sh "curl -f http://${EC2_IP}:5000/health"
                echo "✅ App live at http://${EC2_IP}"
            }
        }
    }

    post {
        success {
            echo '✅ DEPLOYMENT SUCCESSFUL — http://${EC2_IP}'
        }
        failure {
            echo '❌ Pipeline failed.'
        }
        always {
            sh 'rm -f /tmp/splitsync_key.pem'
        }
    }
}