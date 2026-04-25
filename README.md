# ⚡ SplitSync — Real-Time Expense Splitter
### DevOps Major Project | AWS + Git + Jenkins + Docker + Terraform + Ansible

---

## 📁 Project Structure
```
splitsync/
├── frontend/          # React + Vite + Socket.io client
├── backend/           # Node.js + Express + Socket.io + PostgreSQL
├── terraform/         # AWS EC2, VPC, Security Groups
├── ansible/           # EC2 config + Docker deployment playbook
├── docker-compose.yml # Multi-container orchestration
├── Jenkinsfile        # CI/CD pipeline definition
└── README.md
```

---

## 🚀 PHASE 1 — LOCAL SETUP & TESTING

### Step 1: Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/splitsync.git
cd splitsync
```

### Step 2: Run locally with Docker Compose
```bash
# Build and start all containers (DB + Backend + Frontend)
docker-compose up --build

# App runs at:
# Frontend → http://localhost:80
# Backend  → http://localhost:5000
# Health   → http://localhost:5000/health
```

### Step 3: Run backend manually (without Docker)
```bash
cd backend
npm install
# Set env vars
export DB_HOST=localhost DB_PORT=5432 DB_NAME=splitsync DB_USER=postgres DB_PASSWORD=postgres
npm start
```

### Step 4: Run frontend manually (without Docker)
```bash
cd frontend
npm install
VITE_API_URL=http://localhost:5000 npm run dev
# Open http://localhost:3000
```

---

## ☁️ PHASE 2 — AWS SETUP (One-Time)

### Step 5: Install AWS CLI
```bash
# Linux/Mac
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure with your credentials
aws configure
# Enter: AWS Access Key ID, Secret, Region (ap-south-1), Output (json)
```

### Step 6: Install Terraform
```bash
# Ubuntu/Debian
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform -y
terraform -version
```

### Step 7: Install Ansible
```bash
sudo apt update
sudo apt install ansible -y
ansible --version
```

### Step 8: Create EC2 Key Pair on AWS Console
```
AWS Console → EC2 → Key Pairs → Create Key Pair
Name: splitsync-key
Format: .pem
Download and save it → move to ~/.ssh/splitsync-key.pem
chmod 400 ~/.ssh/splitsync-key.pem
```

---

## 🏗️ PHASE 3 — MANUAL TERRAFORM DEPLOY (Test before Jenkins)

### Step 9: Provision AWS Infrastructure
```bash
cd terraform

# Initialize Terraform
terraform init

# Preview what will be created
terraform plan \
  -var="key_name=splitsync-key" \
  -var="my_ip=$(curl -s https://checkip.amazonaws.com)/32"

# Create EC2 + VPC + Security Groups
terraform apply -auto-approve \
  -var="key_name=splitsync-key" \
  -var="my_ip=$(curl -s https://checkip.amazonaws.com)/32"

# Get the EC2 public IP
terraform output ec2_public_ip
# Save this IP — you'll need it below
```

### Step 10: Update Ansible inventory with EC2 IP
```bash
# Replace EC2_PUBLIC_IP_PLACEHOLDER with actual IP
sed -i 's/EC2_PUBLIC_IP_PLACEHOLDER/YOUR_EC2_IP/' ansible/inventory.ini

# Also update the key path
sed -i 's|your-key.pem|~/.ssh/splitsync-key.pem|' ansible/inventory.ini
```

### Step 11: Run Ansible Playbook
```bash
cd ..  # back to root
export GIT_REPO_URL=https://github.com/YOUR_USERNAME/splitsync.git
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
```

### Step 12: Access Your App
```
Open browser → http://YOUR_EC2_IP
```

---

## 🔧 PHASE 4 — JENKINS CI/CD PIPELINE SETUP

### Step 13: Install Jenkins
```bash
# On your local machine or a server
sudo apt update
sudo apt install openjdk-17-jdk -y

curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
    /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
    https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
    /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update && sudo apt install jenkins -y
sudo systemctl start jenkins && sudo systemctl enable jenkins
```

### Step 14: Install plugins on Jenkins
```
Jenkins → Manage Jenkins → Plugins → Install:
- Pipeline
- Git plugin
- Credentials Binding
- SSH Agent
```

### Step 15: Add credentials in Jenkins
```
Jenkins → Manage Jenkins → Credentials → Global → Add:

1. AWS_ACCESS_KEY_ID     → Kind: Secret text
2. AWS_SECRET_ACCESS_KEY → Kind: Secret text
3. EC2_SSH_KEY           → Kind: Secret file → upload splitsync-key.pem
```

### Step 16: Create Jenkins Pipeline Job
```
Jenkins → New Item → Pipeline → Name: splitsync-pipeline
→ Pipeline section:
  Definition: Pipeline script from SCM
  SCM: Git
  Repository URL: https://github.com/YOUR_USERNAME/splitsync.git
  Script Path: Jenkinsfile
→ Build Triggers: GitHub hook trigger for GITScm polling
→ Save
```

### Step 17: Add GitHub Webhook
```
GitHub Repo → Settings → Webhooks → Add webhook
Payload URL: http://YOUR_JENKINS_IP:8080/github-webhook/
Content type: application/json
Trigger: Just the push event
```

### Step 18: ONE-CLICK DEPLOY 🚀
```bash
# Make any change to code, commit and push:
git add .
git commit -m "feat: update UI"
git push origin main

# Jenkins auto-triggers → runs all 6 stages → app live on AWS!
```

---

## 🔄 Teardown (After Demo)
```bash
cd terraform
terraform destroy -auto-approve \
  -var="key_name=splitsync-key" \
  -var="my_ip=$(curl -s https://checkip.amazonaws.com)/32"
```

---

## 🐳 Useful Docker Commands
```bash
# Check running containers
docker ps

# View backend logs
docker logs splitsync-backend -f

# View frontend logs
docker logs splitsync-frontend -f

# Restart all containers
docker-compose restart

# Stop all
docker-compose down
```

---

## ✅ Demo Checklist
- [ ] Open app on two browser tabs (simulate two users)
- [ ] Create a group on Tab 1 → visible on Tab 2 after refresh
- [ ] Add members to the group
- [ ] Add an expense on Tab 1 → Tab 2 updates LIVE (no refresh)
- [ ] Show Balances tab — net amounts calculated
- [ ] Click "Mark Paid" → Tab 2 gets live notification
- [ ] Show Jenkins dashboard — trigger pipeline, show 6 stages
- [ ] Show Terraform output — EC2 provisioned
- [ ] Show running containers: docker ps on EC2
