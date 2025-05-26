
# Offramp Backend
This is a NodeJS backend that enables users to seamlessly convert cryptocurrency into fiat through a secure and efficient transaction flow. It includes JWT for authentication, real-time blockchain indexing for crypto payment tracking, and a fiat settlement mechanism.

## 🚀 Getting Started
### Prerequisites
- Node.js 18+
- PostgreSQL
- Yarn

### Setup
Clone the repository
```bash
git clone https://github.com/yourusername/crypto-offramp.git
cd crypto-offramp
```
Install dependencies
```bash
yarn
```

Create environment file
```bash
cp .env.example .env
```

### Setup your database
Create a PostgreSQL database.

Add the DB credentials to .env.

### Add your API keys and config
- Google OAuth credentials
- Blockchain RPC endpoints
- Exchange API keys (e.g. Binance)
- Payment provider keys (e.g. Paystack, Monnify)
- Socket & webhook URLs
```bash
### Run migration
node ace migration:fresh
```
```bash
### Run the seeder
node ace db:seed
```
```bash
### Run the development server
yarn dev
```
