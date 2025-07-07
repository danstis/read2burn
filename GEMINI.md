# GEMINI.md

This file provides guidance to Gemini CLI when working with code in this repository.

## Project Overview

Read2burn is a Node.js application for secure password/secret transportation. It encrypts entries and generates secret links that self-destruct after being accessed once. The application uses Express.js for the web server, NeDB for data storage, and AES-256 encryption for securing secrets.

## Development Commands

- **Start application**: `node app.js`
- **Install dependencies**: `npm install`
- **Lint code**: `npx eslint .` (ESLint is available as dev dependency)
- **Format code**: `npx prettier .` (Prettier is available as dev dependency)
- **Run tests**: `npx jest --coverage` (Jest is used for testing, test files are in `test/`)

## Test Coverage Requirement

- All new code should target at least 60% test coverage.

## Architecture Overview

### Core Components

- **app.js**: Main application entry point that configures Express server, sets up middleware, database connection, and scheduled cleanup tasks
- **routes/index.js**: Single route handler managing both GET and POST requests for creating and retrieving secrets
- **migrations/**: Database migration scripts for upgrading data storage from file-based to NeDB
- **data/**: Contains NeDB database file and migration state

### Key Configuration

- **Port**: Configurable via `PORT` environment variable (default: 3300)
- **Cleanup Schedule**: Configurable via `CLEANUP_CRON` environment variable (default: `12 0 * * *` - daily at 00:12)
- **Secret Expiry**: Configurable via `EXPIRY` environment variable (default: 7776000000ms - 90 days)
- **Database**: NeDB file-based database at `data/read2burn.db`

### Security Implementation

- **Encryption**: AES-256 cipher with a unique, random IV for each secret
- **Key Generation**: Secure random keys using `crypto.randomBytes()`
- **Key Structure**: Combined file key (8 chars) + password key (12 chars), for strong security
- **Cryptor Module**: All cryptographic operations are handled in `lib/cryptor.js`
- **Recent Changes**: Improved key management and IV handling for enhanced security and compatibility
- **Auto-cleanup**: Scheduled deletion of expired secrets via node-cron

### Data Flow

1. **Secret Creation**: User submits secret → encrypt with random key → store in NeDB → return shareable URL
2. **Secret Retrieval**: User visits URL → decrypt secret → display to user → delete from database
3. **Cleanup**: Scheduled job removes expired secrets and compacts database

### Database Schema

NeDB documents contain:

- `key`: Unique identifier for the secret
- `timestamp`: Creation timestamp for expiry calculation
- `encrypted`: AES-256 encrypted secret content
- `iv`: Initialization vector for decryption

### Internationalization

- Supports English and German locales
- Uses i18n middleware with locale files in `locales/`
- Language detection via Accept-Language header

## Important Notes

- No build process required - runs directly with Node.js
- Database migrations are handled automatically via Umzug on startup
- Static assets served from `public/` directory
- EJS templates in `views/` directory (currently only index.ejs)
- Docker support available via Dockerfile and docker-compose.yml

## Testing

- Automated tests are located in the `test/` directory.
- Run all tests with `npm test` or `npx jest`.
- Test files include:
  - `test/crypto.test.js`: Encryption/decryption logic
  - `test/database.test.js`: Database operations
  - `test/routes-simple.test.js`: Route handling
  - `test/setup.js`: Test setup utilities
