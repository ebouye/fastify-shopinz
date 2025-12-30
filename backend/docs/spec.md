# Fastify + TypeScript Project Specification

## Project Structure

```
src/
├── app.ts                 # Fastify app initialization
├── server.ts              # Server entry point
├── config/
│   ├── index.ts           # Config loader
│   └── env.ts             # Environment validation (zod)
├── plugins/
│   ├── auth.ts            # JWT/Auth plugin
│   ├── database.ts        # Database connection
│   └── swagger.ts         # API documentation
├── modules/
│   └── [module]/
│       ├── [module].controller.ts
│       ├── [module].service.ts
│       ├── [module].repository.ts
│       ├── [module].schema.ts      # Zod schemas
│       ├── [module].routes.ts
│       └── [module].types.ts
├── shared/
│   ├── errors/
│   │   └── http-errors.ts
│   ├── middlewares/
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   └── helpers.ts
│   └── types/
│       └── index.ts
├── database/
│   ├── migrations/
│   └── seeds/
└── tests/
    ├── unit/
    └── integration/
```

---

## Architecture Pattern

### Layered Architecture (Controller → Service → Repository)

```
┌─────────────┐
│   Routes    │  Define endpoints, attach handlers
└──────┬──────┘
       ↓
┌─────────────┐
│ Controller  │  Handle HTTP request/response, validation
└──────┬──────┘
       ↓
┌─────────────┐
│  Service    │  Business logic, orchestration
└──────┬──────┘
       ↓
┌─────────────┐
│ Repository  │  Database queries only
└─────────────┘
```

**Rules:**
- Controllers never access database directly
- Services never access `request`/`reply` objects
- Repositories contain only SQL/ORM queries

---

## Code Standards

### 1. Environment Configuration

```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
```

### 2. Plugin Registration

```typescript
// src/app.ts
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register plugins
  await app.register(import('./plugins/database'));
  await app.register(import('./plugins/auth'));
  
  // Register routes
  await app.register(import('./modules/user/user.routes'), { prefix: '/api/users' });

  return app;
}
```

### 3. Route Definition

```typescript
// src/modules/user/user.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { UserController } from './user.controller';
import { CreateUserSchema, GetUserSchema } from './user.schema';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  const controller = new UserController(fastify);

  fastify.post('/', { schema: CreateUserSchema }, controller.create);
  fastify.get('/:id', { schema: GetUserSchema }, controller.getById);
};

export default userRoutes;
```

### 4. Schema Validation (Zod + TypeBox)

```typescript
// src/modules/user/user.schema.ts
import { Type, Static } from '@sinclair/typebox';

export const CreateUserBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  name: Type.String({ minLength: 2 }),
});

export type CreateUserBodyType = Static<typeof CreateUserBody>;

export const CreateUserSchema = {
  body: CreateUserBody,
  response: {
    201: Type.Object({
      id: Type.String(),
      email: Type.String(),
    }),
  },
};
```

### 5. Controller Pattern

```typescript
// src/modules/user/user.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { UserService } from './user.service';
import { CreateUserBodyType } from './user.schema';

export class UserController {
  private userService: UserService;

  constructor(fastify: FastifyInstance) {
    this.userService = new UserService(fastify);
  }

  create = async (
    request: FastifyRequest<{ Body: CreateUserBodyType }>,
    reply: FastifyReply
  ) => {
    const user = await this.userService.create(request.body);
    return reply.status(201).send(user);
  };
}
```

### 6. Service Pattern

```typescript
// src/modules/user/user.service.ts
import { UserRepository } from './user.repository';
import { CreateUserBodyType } from './user.schema';
import { hashPassword } from '@/shared/utils/crypto';
import { ConflictError } from '@/shared/errors/http-errors';

export class UserService {
  private userRepo: UserRepository;

  constructor(fastify: FastifyInstance) {
    this.userRepo = new UserRepository(fastify.db);
  }

  async create(data: CreateUserBodyType) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('Email already exists');
    }

    const hashedPassword = await hashPassword(data.password);
    return this.userRepo.create({ ...data, password: hashedPassword });
  }
}
```

### 7. Repository Pattern

```typescript
// src/modules/user/user.repository.ts
import { Kysely } from 'kysely';
import { DB } from '@/database/types';

export class UserRepository {
  constructor(private db: Kysely<DB>) {}

  async findByEmail(email: string) {
    return this.db
      .selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst();
  }

  async create(data: { email: string; password: string; name: string }) {
    return this.db
      .insertInto('users')
      .values(data)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
```

### 8. Error Handling

```typescript
// src/shared/errors/http-errors.ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource already exists') {
    super(409, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}
```

```typescript
// src/plugins/error-handler.ts
import { FastifyPluginAsync } from 'fastify';
import { HttpError } from '@/shared/errors/http-errors';

const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: error.message,
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  });
};

export default errorHandler;
```

---

## Best Practices

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-profile.service.ts` |
| Classes | PascalCase | `UserService` |
| Functions/Variables | camelCase | `getUserById` |
| Constants | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Database Tables | snake_case | `order_items` |
| Interfaces/Types | PascalCase | `UserResponse` |

### Import Order

```typescript
// 1. Node built-ins
import path from 'path';

// 2. External packages
import Fastify from 'fastify';
import { z } from 'zod';

// 3. Internal modules (use path aliases)
import { UserService } from '@/modules/user/user.service';
import { HttpError } from '@/shared/errors/http-errors';

// 4. Relative imports
import { formatDate } from './helpers';
```

### Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Database Guidelines

### Use Kysely (Type-safe Query Builders)

```typescript
// Prefer query builders over raw SQL
const users = await db
  .selectFrom('users')
  .where('status', '=', 'active')
  .select(['id', 'email', 'name'])
  .execute();
```

### Migration Naming

```
YYYYMMDDHHMMSS_description.ts
20241229120000_create_users_table.ts
20241229120100_add_orders_table.ts
```

### Transaction Pattern

```typescript
async transferFunds(fromId: string, toId: string, amount: number) {
  return this.db.transaction().execute(async (trx) => {
    await trx
      .updateTable('accounts')
      .set({ balance: sql`balance - ${amount}` })
      .where('id', '=', fromId)
      .execute();

    await trx
      .updateTable('accounts')
      .set({ balance: sql`balance + ${amount}` })
      .where('id', '=', toId)
      .execute();
  });
}
```

---

## Testing Standards

### Unit Test Example

```typescript
// src/modules/user/__tests__/user.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../user.service';

describe('UserService', () => {
  it('should throw ConflictError when email exists', async () => {
    const mockRepo = {
      findByEmail: vi.fn().mockResolvedValue({ id: '1', email: 'test@test.com' }),
    };

    const service = new UserService(mockRepo as any);

    await expect(service.create({ email: 'test@test.com', password: '12345678', name: 'Test' }))
      .rejects.toThrow('Email already exists');
  });
});
```

### Integration Test Example

```typescript
// src/tests/integration/user.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@/app';

describe('User API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/users - should create user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('id');
  });
});
```

---

## Recommended Dependencies

```json
{
  "dependencies": {
    "fastify": "^5.6.2",
    "@fastify/cors": "^10.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/multipart": "^9.0.0",
    "@sinclair/typebox": "^0.34.0",
    "dotenv": "^17.2.3",
    "kysely": "^0.27.0",
    "pg": "^8.13.0",
    "zod": "^3.24.0",
    "bcrypt": "^5.1.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.0",
    "@types/node": "^25.0.3",
    "tsx": "^4.21.0"
  }
}
```

---

## Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "migrate": "kysely migrate:latest",
    "migrate:create": "kysely migrate:make"
  }
}
```
