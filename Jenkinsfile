pipeline {
    agent any

    environment {
        AWS_REGION        = 'ap-south-1'
        TF_DIR            = 'terraform'
        ANSIBLE_DIR       = 'ansible'
        KEY_PATH          = credentials('EC2_SSH_KEY')        // Add in Jenkins credentials
        GIT_REPO_URL      = 'https://github.com/anu1240/splitsync.git'
    }

    stages {

        stage('1. Checkout') {
            steps {
                echo '📥 Pulling latest code from GitHub...'
                checkout scm
            }
        }

        stage('2. Lint & Validate') {
            steps {
                echo '🔍 Validating Terraform config...'
                dir("${TF_DIR}") {
                    sh 'terraform init -backend=false'
                    sh 'terraform validate'
                }
            }
        }

        stage('3. Terraform - Provision AWS Infra') {
            steps {
                echo '☁️ Provisioning EC2, VPC, Security Groups on AWS...'
                withCredentials([
                    string(credentialsId: 'AWS_ACCESS_KEY_ID',     variable: 'AWS_ACCESS_KEY_ID'),
                    string(credentialsId: 'AWS_SECRET_ACCESS_KEY',  variable: 'AWS_SECRET_ACCESS_KEY')
                ]) {
                    dir("${TF_DIR}") {
                        sh '''
                            export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
                            export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
                            terraform init
                            terraform apply -auto-approve \
                                -var="key_name=splitsync-key" \
                                -var="my_ip=$(curl -s https://checkip.amazonaws.com)/32" \
                                -var="aws_region=${AWS_REGION}"
                        '''
                        script {
                            env.EC2_PUBLIC_IP = sh(
                                script: 'terraform output -raw ec2_public_ip',
                                returnStdout: true
                            ).trim()
                        }
                    }
                }
                echo "✅ EC2 provisioned at: ${env.EC2_PUBLIC_IP}"
            }
        }

        stage('4. Wait for EC2 to be Ready') {
            steps {
                echo '⏳ Waiting for EC2 instance to boot...'
                sh 'sleep 45'
                sh """
                    timeout 120 bash -c 'until ssh -o StrictHostKeyChecking=no -i ${KEY_PATH} ubuntu@${env.EC2_PUBLIC_IP} "echo ready" 2>/dev/null; do sleep 5; done'
                """
            }
        }

        stage('5. Ansible - Configure & Deploy') {
            steps {
                echo '⚙️ Running Ansible playbook — installing Docker, deploying containers...'
                sh """
                    sed -i 's/EC2_PUBLIC_IP_PLACEHOLDER/${env.EC2_PUBLIC_IP}/' ${ANSIBLE_DIR}/inventory.ini
                    cp ${KEY_PATH} /tmp/splitsync_key.pem
                    chmod 600 /tmp/splitsync_key.pem
                    sed -i 's|your-key.pem|/tmp/splitsync_key.pem|' ${ANSIBLE_DIR}/inventory.ini
                    export GIT_REPO_URL=${GIT_REPO_URL}
                    ansible-playbook -i ${ANSIBLE_DIR}/inventory.ini ${ANSIBLE_DIR}/playbook.yml
                """
            }
        }

        stage('6. Health Check') {
            steps {
                echo '🏥 Verifying application is live...'
                sh """
                    sleep 15
                    curl -f http://${env.EC2_PUBLIC_IP}/health || exit 1
                    echo "✅ App is live at http://${env.EC2_PUBLIC_IP}"
                """
            }
        }
    }

    post {
        success {
            echo """
            ╔══════════════════════════════════════════╗
            ║  ✅ DEPLOYMENT SUCCESSFUL                ║
            ║  🌐 App URL: http://${env.EC2_PUBLIC_IP} ║
            ╚══════════════════════════════════════════╝
            """
        }
        failure {
            echo '❌ Pipeline failed. Check logs above.'
        }
        always {
            sh 'rm -f /tmp/splitsync_key.pem'
        }
    }
}
