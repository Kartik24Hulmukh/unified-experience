P# Code Citations

## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/zhoujd/zzemacs/blob/22a194e7bbbda4b7739cb0fb9be28f9b37a140f0/docker/script/install-docker.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: MIT
https://github.com/dokku/dokku/blob/a5e2b51bc2ef5995148b64d57bfcf62579618145/Dockerfile

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/linode/docs/blob/4a3fddb8e832380c9b9fe979baf6799eb3ff7b4b/docs/reference-architecture/cloud-based-document-management-system/guides/implementing-cloud-based-document-management-system/cbdms-terraform/scripts/cbdms-app-node.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```


## License: unknown
https://github.com/janpipan/Diploma/blob/123c5a8770e289ed2e2bcc0dcec5d70ad4a5d16c/Diploma/KuberntesInit/nodeSetup.sh

```
Now I have a complete picture of your project. Here's a detailed, step-by-step guide tailored to **BErozgar's** exact stack (Vite React SPA + Fastify API + PostgreSQL + Nginx, all Docker Composed).

---

## Deploying BErozgar to DigitalOcean (Droplet)

Your project already has a production-ready `docker-compose.prod.yml`, so the best fit is a **DigitalOcean Droplet** running Docker.

---

### Prerequisites

- A DigitalOcean account (https://cloud.digitalocean.com)
- A domain name (e.g. `berozgar.in`) with DNS you can edit
- Your repo pushed to GitHub (`Kartik24Hulmukh/unified-experience`)

---

### Step 1 — Create a Droplet

1. Go to **Create > Droplets**
2. Choose:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic, **$12/mo** (2 GB RAM / 1 vCPU) minimum — recommended **$24/mo** (4 GB) since you run Postgres + Fastify + Nginx
   - **Datacenter:** Choose closest to your users (e.g. Bangalore `BLR1`)
   - **Authentication:** SSH key (strongly recommended) or password
3. Click **Create Droplet** and note the IP address

---

### Step 2 — Point DNS to the Droplet

In your domain registrar (or DigitalOcean Networking):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<DROPLET_IP>` | 300 |
| A | `www` | `<DROPLET_IP>` | 300 |

Wait for propagation (usually 5-15 min).

---

### Step 3 — Initial Server Setup

SSH into the droplet:

```bash
ssh root@<DROPLET_IP>
```

Run these commands:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker + Docker Compose
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
docker compose version

# Install git
```

