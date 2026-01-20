# Divvy-Jones

A modern expense splitting application API built with Elysia.js and Bun.

## Features

- User authentication (JWT-based)
- Group management with role-based permissions
- Expense tracking with flexible splitting options
- Settlement suggestions and tracking
- Multi-currency support with real-time exchange rates
- File attachments (S3 or local storage)
- Data export (CSV and JSON)
- Activity logging

## Tech Stack

- **Runtime:** Bun
- **Framework:** Elysia.js
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT
- **Storage:** Local filesystem or AWS S3

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- PostgreSQL 14+
- (Optional) AWS S3 bucket for production file storage

### Installation

1. Clone the repository:
   ```bash
   git clone git@github.com:XtheWiz/divvy-jones-backend.git
   cd divvy-jones-backend
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   bun run db:push
   ```

5. (Optional) Seed the database:
   ```bash
   bun run db:seed
   ```

6. Start the development server:
   ```bash
   bun run dev
   ```

The API will be available at `http://localhost:3000`.

## API Documentation

Interactive API documentation is available at `http://localhost:3000/swagger` when the server is running.

### Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/auth/login` | User authentication |
| `GET /v1/groups` | List user's groups |
| `POST /v1/groups/:groupId/expenses` | Create expense |
| `GET /v1/groups/:groupId/balances` | Get group balances |
| `GET /v1/groups/:groupId/settlements/suggested` | Get settlement suggestions |
| `GET /v1/currencies` | List supported currencies |
| `GET /v1/groups/:groupId/export/csv` | Export expenses as CSV |

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

#### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars in production) |

#### Storage Configuration

**Local Storage (Development):**
```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./uploads
```

**S3 Storage (Production):**
```env
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_URL_EXPIRY=3600
```

#### Exchange Rate API

For multi-currency support, configure the exchange rate API:
```env
EXCHANGE_RATE_API_KEY=your-api-key
EXCHANGE_RATE_CACHE_TTL=3600000
```

Sign up for a free API key at [exchangerate-api.com](https://www.exchangerate-api.com/).

## Production Deployment

### Security Checklist

- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Use `STORAGE_PROVIDER=s3` with proper IAM permissions
- [ ] Configure CORS origins appropriately
- [ ] Enable rate limiting
- [ ] Use HTTPS

### AWS S3 IAM Policy

Minimum required permissions for the S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### Docker Deployment

```dockerfile
FROM oven/bun:1

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "start"]
```

## Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build for production |
| `bun run test` | Run all tests |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run typecheck:src` | Type check source files only |
| `bun run lint:routes` | Check route parameter naming conventions |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Run database migrations |
| `bun run db:push` | Push schema changes to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:test:setup` | Set up test database |
| `bun run db:test:reset` | Reset test database |

### Pre-commit Hooks

The project uses Husky for pre-commit hooks that run:
1. Route parameter naming convention check
2. TypeScript type checking
3. Unit tests

To set up hooks after cloning:
```bash
bun run prepare
```

### Code Style

- Route parameters use camelCase with `Id` suffix (e.g., `:groupId`, `:expenseId`)
- Services follow the singleton pattern where appropriate
- All endpoints include Swagger documentation tags

## Supported Currencies

| Code | Currency |
|------|----------|
| USD | US Dollar |
| EUR | Euro |
| GBP | British Pound |
| JPY | Japanese Yen |
| CAD | Canadian Dollar |
| AUD | Australian Dollar |
| CHF | Swiss Franc |
| CNY | Chinese Yuan |

## License

MIT

## Troubleshooting

### Common Issues

**"JWT_SECRET environment variable is required in production"**
- Set a strong JWT_SECRET in your .env file when NODE_ENV=production

**S3 upload fails with "Access Denied"**
- Verify your AWS credentials are correct
- Check the IAM policy includes s3:PutObject permission
- Ensure the bucket name is correct

**Exchange rate API returns fallback rates**
- Check if EXCHANGE_RATE_API_KEY is set
- The free tier has rate limits; the service will use cached/fallback rates

**Tests fail with "DATABASE_URL_TEST required"**
- Set DATABASE_URL_TEST in your .env file
- Run `bun run db:test:setup` to create the test database
