terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── VARIABLES ────────────────────────────────────────────
variable "aws_region"    { default = "ap-south-1" }
variable "key_name"      { description = "Your AWS EC2 Key Pair name" }
variable "my_ip"         { description = "Your IP for SSH access (x.x.x.x/32)" }

# ─── VPC ──────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "splitsync-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "splitsync-igw" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags = { Name = "splitsync-public-subnet" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "splitsync-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ─── SECURITY GROUP ───────────────────────────────────────
resource "aws_security_group" "app_sg" {
  name   = "splitsync-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
    description = "SSH"
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }
  ingress {
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Backend API"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "splitsync-sg" }
}

# ─── EC2 INSTANCE ─────────────────────────────────────────
variable "ami_id" {
  default = "ami-0f58b397bc5c1f2e8"
}
resource "aws_instance" "app" {
  ami                    = var.ami_id
  instance_type          = "t3.micro"
  key_name               = var.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp2"
  }

  tags = { Name = "splitsync-server" }
}

# ─── OUTPUTS ──────────────────────────────────────────────
output "ec2_public_ip" {
  value       = aws_instance.app.public_ip
  description = "Public IP of the EC2 instance"
}

output "app_url" {
  value       = "http://${aws_instance.app.public_ip}"
  description = "SplitSync App URL"
}
