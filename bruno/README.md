# Divvy-Jones API Collection

Bruno API collection for the Divvy-Jones expense splitting application.

## Setup

1. **Install Bruno**
   ```bash
   # macOS
   brew install bruno

   # Or download from https://www.usebruno.com/
   ```

2. **Open Collection**
   - Open Bruno
   - File → Open Collection
   - Navigate to this `bruno/` directory

3. **Select Environment**
   - Click the environment dropdown (top-right)
   - Select "local" for local development

## Collection Structure

```
bruno/
├── bruno.json              # Collection config
├── environments/
│   └── local.bru           # Local development environment
├── Auth/                   # Authentication endpoints
│   ├── Register.bru
│   ├── Login.bru
│   ├── Refresh Token.bru
│   └── Forgot Password.bru
├── Groups/                 # Group management
│   ├── Create Group.bru
│   ├── List Groups.bru
│   ├── Get Group.bru
│   ├── Join Group.bru
│   └── Get Balances.bru
├── Expenses/               # Expense tracking
│   ├── Create Expense.bru
│   ├── List Expenses.bru
│   └── Get Expense.bru
├── Settlements/            # Debt settlements
│   ├── Create Settlement.bru
│   ├── List Settlements.bru
│   ├── Confirm Settlement.bru
│   └── Suggested Settlements.bru
├── Users/                  # User profile
│   ├── Get Profile.bru
│   ├── Update Preferences.bru
│   └── Export Data.bru
├── Analytics/              # Spending analytics
│   ├── Spending Summary.bru
│   ├── Category Breakdown.bru
│   └── Spending Trends.bru
└── Recurring/              # Recurring expenses
    ├── Create Recurring Expense.bru
    └── List Recurring Expenses.bru
```

## Usage

### Quick Start Flow

1. **Register** - Create a new account (Auth/Register)
2. **Create Group** - Create an expense group (Groups/Create Group)
3. **Create Expense** - Add an expense (Expenses/Create Expense)
4. **Check Balances** - View who owes what (Groups/Get Balances)
5. **Settle Up** - Create and confirm settlements

### Auto-Token Handling

The Login and Register requests automatically save tokens to environment variables:
- `accessToken` - JWT access token (15 min expiry)
- `refreshToken` - Refresh token (30 day expiry)

All authenticated requests use `{{accessToken}}` automatically.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `baseUrl` | API base URL |
| `accessToken` | Current access token |
| `refreshToken` | Current refresh token |
| `testEmail` | Default test email |
| `testPassword` | Default test password |
| `groupId` | Current group ID |
| `expenseId` | Current expense ID |
| `settlementId` | Current settlement ID |

## API Documentation

Full API documentation available at:
- **Swagger UI**: http://localhost:3000/swagger
- **OpenAPI JSON**: http://localhost:3000/swagger/json

## Tips

- Use `~` prefix on query params to disable them (e.g., `~currency: USD`)
- Check the "Docs" tab in each request for detailed documentation
- Response scripts auto-save IDs for chaining requests
