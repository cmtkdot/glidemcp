# GitHub Deploy Key Setup for Portainer

## If Your Repository is Private

### Step 1: Generate SSH Key in Portainer
```bash
# In Portainer console or SSH to your server
ssh-keygen -t rsa -b 4096 -C "portainer@yourserver.com"
cat ~/.ssh/id_rsa.pub
```

### Step 2: Add Deploy Key to GitHub
1. Go to https://github.com/cmtkdot/glidemcp/settings/keys
2. Click "Add deploy key"
3. Title: "Portainer Server"
4. Key: Paste the public key from Step 1
5. Check "Allow write access" if needed
6. Click "Add key"

### Step 3: Update Docker Compose
```yaml
version: '3.8'

services:
  glide-api-gateway:
    image: node:18-alpine
    container_name: glide-api-gateway
    restart: unless-stopped
    working_dir: /app
    command: >
      sh -c "
      apk add --no-cache git curl wget openssh &&
      mkdir -p ~/.ssh &&
      echo 'StrictHostKeyChecking no' >> ~/.ssh/config &&
      git clone git@github.com:cmtkdot/glidemcp.git . &&
      npm install &&
      node index.js
      "
    ports:
      - "8080:3000"
    volumes:
      - ~/.ssh:/root/.ssh:ro  # Mount SSH keys
    environment:
      # ... your environment variables
    networks:
      - glide-network
```

## For Public Repository (Recommended)

Make sure your repository is public:
1. Go to https://github.com/cmtkdot/glidemcp/settings
2. Scroll to "Danger Zone"
3. Click "Change repository visibility"
4. Select "Make public"
5. Use the original deployment YAML with HTTPS clone