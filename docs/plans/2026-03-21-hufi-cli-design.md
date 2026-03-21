# HuFi CLI 设计文档

## 项目概述

HuFi CLI 是一个基于 TypeScript 的命令行工具，用于访问 hu.fi 平台的各种功能。它通过封装 hu.fi API，为开发者提供便捷的命令行接口。

## 技术架构

### 核心组件

1. **CLI 入口** (`src/cli.ts`)
   - 使用 Commander.js 构建命令行界面
   - 支持全局帮助和版本信息
   - 错误处理和用户反馈

2. **认证模块** (`src/auth/`)
   - API Key 认证
   - 配置文件管理
   - 环境变量支持

3. **API 客户端** (`src/api/`)
   - 封装 hu.fi API 调用
   - 请求/响应拦截
   - 错误处理和重试机制

4. **命令模块** (`src/commands/`)
   - 模块化命令实现
   - 支持动态加载
   - 命令间共享上下文

### 目录结构

```
hufi-cli/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 主入口
│   ├── auth/               # 认证相关
│   │   ├── auth.ts
│   │   └── config.ts
│   ├── api/                # API 客户端
│   │   ├── client.ts
│   │   └── types.ts
│   ├── commands/           # 命令实现
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── campaign.ts
│   │   └── exchange.ts
│   └── utils/              # 工具函数
│       ├── logger.ts
│       ├── validation.ts
│       └── helpers.ts
├── docs/
│   └── plans/
├── package.json
├── tsconfig.json
└── README.md
```

## 核心功能模块

### 1. 认证管理

```typescript
// 支持的认证方式
interface AuthConfig {
  apiKey?: string;
  privateKey?: string;
  accessToken?: string;
  refreshToken?: string;
}
```

- 支持 API Key 认证
- 支持钱包私钥认证
- 配置文件持久化
- 环境变量回退

### 2. 命令系统

#### 基础命令结构
```bash
hufi-cli <command> [options]
```

#### 主要命令组

1. **认证命令**
   ```bash
   hufi-cli auth login --api-key <key>
   hufi-cli auth status
   hufi-cli auth logout
   ```

2. **Campaign 命令**
   ```bash
   hufi-cli campaign list
   hufi-cli campaign join --chain-id <id> --address <addr>
   hufi-cli campaign status --chain-id <id> --address <addr>
   ```

3. **交易所命令**
   ```bash
   hufi-cli exchange list
   hufi-cli exchange register --name <name> --api-key <key> --secret <secret>
   ```

4. **钱包命令**
   ```bash
   hufi-cli wallet create
   hufi-cli wallet import --private-key <key>
   hufi-cli wallet balance
   ```

### 3. API 客户端

```typescript
// API 客户端接口
interface HuFiClient {
  // 认证相关
  auth: {
    login(credentials: Credentials): Promise<AuthResponse>;
    refresh(refreshToken: string): Promise<AuthResponse>;
  };
  
  // Campaign 相关
  campaigns: {
    list(params?: ListParams): Promise<Campaign[]>;
    join(chainId: number, address: string): Promise<JoinResult>;
    checkJoinStatus(chainId: number, address: string): Promise<JoinStatus>;
  };
  
  // 交易所相关
  exchanges: {
    list(): Promise<Exchange[]>;
    register(apiKey: ExchangeApiKey): Promise<RegistrationResult>;
  };
}
```

## 配置管理

### 配置文件

位置：`~/.hufi/config.json`

```json
{
  "apiKey": "your-api-key",
  "defaultChainId": 137,
  "outputFormat": "json",
  "verbose": false
}
```

### 环境变量

```bash
HUFI_API_KEY=your-api-key
HUFI_DEFAULT_CHAIN_ID=137
HUFI_OUTPUT_FORMAT=json
HUFI_VERBOSE=false
```

## 输出格式

### 支持格式

1. **JSON** (`--json`)
   - 结构化数据输出
   - 适合脚本处理

2. **表格** (`--table`)
   - 人类可读格式
   - 默认输出格式

3. **YAML** (`--yaml`)
   - 配置友好格式

### 日志级别

```typescript
enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}
```

## 依赖管理

### 核心依赖

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "inquirer": "^9.2.0",
    "conf": "^12.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/commander": "^2.12.0"
  }
}
```

### 选择理由

1. **Commander.js** - 轻量级，TypeScript 友好
2. **Chalk** - 终端颜色输出
3. **Ora** - 加载动画
4. **Inquirer** - 交互式提示
5. **Conf** - 配置文件管理
6. **Axios** - HTTP 客户端

## 错误处理

### 错误类型

```typescript
class HuFiError extends Error {
  code: string;
  details?: any;
}

class AuthError extends HuFiError {}
class APIError extends HuFiError {}
class ValidationError extends HuFiError {}
class ConfigError extends HuFiError {}
```

### 错误处理策略

1. **网络错误** - 自动重试 3 次
2. **认证错误** - 提示重新登录
3. **验证错误** - 显示详细错误信息
4. **配置错误** - 引导用户配置

## 测试策略

### 测试类型

1. **单元测试** - 核心逻辑测试
2. **集成测试** - API 调用测试
3. **E2E 测试** - 命令行测试

### 测试工具

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

## 部署和分发

### 打包配置

```json
{
  "scripts": {
    "build": "bun build ./src/cli.ts --outdir ./dist --target node",
    "prepublishOnly": "bun run build"
  },
  "bin": {
    "hufi-cli": "./dist/cli.js"
  },
  "files": [
    "dist",
    "README.md"
  ]
}
```

### 发布流程

1. 更新版本号
2. 运行测试
3. 构建项目
4. 发布到 npm

## 开发路线图

### 阶段 1：基础框架
- [ ] 项目初始化和配置
- [ ] CLI 入口和命令系统
- [ ] 基础认证功能
- [ ] API 客户端封装

### 阶段 2：核心功能
- [ ] Campaign 相关命令
- [ ] 交易所集成
- [ ] 钱包管理
- [ ] 配置文件系统

### 阶段 3：增强功能
- [ ] 交互式模式
- [ ] 批量操作
- [ ] 插件系统
- [ ] 自动补全

### 阶段 4：生产就绪
- [ ] 完整测试覆盖
- [ ] 性能优化
- [ ] 文档完善
- [ ] CI/CD 集成

## 安全考虑

1. **密钥管理**
   - 永不存储私钥在配置文件中
   - 使用系统密钥环存储敏感信息
   - 支持环境变量注入

2. **API 安全**
   - 所有请求使用 HTTPS
   - 实现请求签名验证
   - 支持 API 速率限制

3. **输入验证**
   - 严格验证所有用户输入
   - 防止注入攻击
   - 参数消毒

## 性能优化

1. **请求优化**
   - 连接池复用
   - 响应缓存
   - 批量请求支持

2. **内存管理**
   - 流式处理大数据
   - 及时释放资源
   - 避免内存泄漏

3. **启动优化**
   - 懒加载模块
   - 按需导入依赖
   - 最小化启动时间

## 监控和日志

### 日志配置

```typescript
interface LogConfig {
  level: LogLevel;
  file?: string;
  format: 'json' | 'text';
  rotation?: {
    maxSize: string;
    maxFiles: number;
  };
}
```

### 监控指标

1. **命令执行时间**
2. **API 响应时间**
3. **错误率统计**
4. **用户使用模式**

## 国际化

### 支持语言

- 中文 (zh-CN)
- 英文 (en-US)

### 实现方式

```typescript
interface I18nConfig {
  locale: string;
  messages: Record<string, string>;
}
```

## 扩展性

### 插件系统

```typescript
interface Plugin {
  name: string;
  version: string;
  commands?: Command[];
  hooks?: {
    beforeCommand?: (context: Context) => void;
    afterCommand?: (context: Context) => void;
  };
}
```

### 自定义命令

```typescript
interface CustomCommand {
  name: string;
  description: string;
  options: Option[];
  action: (args: any) => Promise<void>;
}
```

## 文档要求

### 用户文档

1. **安装指南**
2. **快速开始**
3. **命令参考**
4. **配置说明**
5. **故障排除**

### 开发者文档

1. **API 参考**
2. **扩展开发**
3. **贡献指南**
4. **架构说明**

## 合规要求

1. **数据隐私** - 符合 GDPR 要求
2. **安全审计** - 定期安全审查
3. **许可证** - MIT 开源许可证
4. **版本管理** - 语义化版本控制