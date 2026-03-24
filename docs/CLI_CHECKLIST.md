# hufi-cli Manual Test Checklist

Track manual testing progress here. Mark `[x]` when verified.

## Global Options

| # | Command / Flag | Description | Tested? |
|---|---|---|---|
| 1 | `hufi --version` | Print version (should be 1.0.1) | [x] output: `1.0.1` |
| 2 | `hufi --help` | Show all top-level commands | [x] lists auth, exchange, campaign, staking, dashboard |
| 3 | `hufi --config-file <path> ...` | Use custom config path | [x] loads config from custom path, defaults when path missing |
| 4 | `hufi --key-file <path> ...` | Use custom key path | [x] loads key from custom path, falls back to config if missing |

## `hufi auth`

| # | Command | Description | Options | Tested? |
|---|---|---|---|---|
| 5 | `hufi auth login` | Login with private key | `-k <key>`, `-u <url>`, `--json` | [x] |
| 6 | `hufi auth generate` | Generate new EVM wallet | `--json` | [x] |
| 7 | `hufi auth status` | Show auth status | `--json` | [x] shows address + API, `--json` returns address/apiUrl/authenticated |
| 8 | `hufi auth --help` | Show auth subcommands | | [x] lists login, generate, status |

## `hufi exchange`

| # | Command | Description | Options | Tested? |
|---|---|---|---|---|
| 9 | `hufi exchange register` | Register exchange API key | `-n <name>` (req, CCXT name), `--api-key <key>` (req), `--secret-key <key>` (req), `--bitmart-memo`, `--json` | [x] help now calls out CCXT names |
| 10 | `hufi exchange list` | List registered keys | `--json` | [x] `--json` returns `[]` after fresh login; invalid token path reminds user to run `auth login` |
| 11 | `hufi exchange delete` | Delete exchange keys | `<name>` preferred, `-n <name>` supported, `--json` | [x] |
| 12 | `hufi exchange revalidate` | Revalidate exchange key | `<name>` preferred, `-n <name>` supported, `--json` | [x] |
| 13 | `hufi exchange --help` | Show exchange subcommands | | [x] lists register, list, delete, revalidate |

## `hufi campaign`

| # | Command | Description | Options | Tested? |
|---|---|---|---|---|
| 14 | `hufi campaign list` | List available campaigns | `-c <chain>`, `-s <status>`, `--page <n>`, `--page-size <n>`, `-l <n>`, `--json` | [x] returns 8 campaigns with full summary, `--json` returns results array |
| 15 | `hufi campaign get` | Get campaign details | `-c <chain>` (req), `-a <addr>` (req), `--json` | [x] |
| 16 | `hufi campaign join` | Join a campaign | `-c <chain>`, `-a <addr>`, `--json` | [x] |
| 17 | `hufi campaign joined` | List joined campaigns | `-l <n>`, `--json` | [x] `--json` returns empty results |
| 18 | `hufi campaign status` | Check join status | `-c <chain>`, `-a <addr>`, `--json` | [x] returns `{ "status": "can_join" }` for test campaign |
| 19 | `hufi campaign progress` | Check campaign progress | `-c <chain>`, `-a <addr>`, `--watch`, `--interval <ms>`, `--json` | [x] |
| 20 | `hufi campaign leaderboard` | View campaign leaderboard | `-c <chain>`, `-a <addr>`, `-r <field>`, `-l <n>`, `--json` | [x] returns `{ "data": [] }` |
| 21 | `hufi campaign create` | Create new campaign | `--type <type>` (req), `--exchange <name>` (req), `--symbol <symbol>` (req), `--start-date <date>` (req), `--end-date <date>` (req), `--fund-token <token>` (req), `--fund-amount <amount>` (req), `--daily-volume-target`, `--daily-balance-target`, `--minimum-balance-target`, `-c <chain>`, `--json` | [ ] |
| 22 | `hufi campaign --help` | Show campaign subcommands | | [x] lists list, get, joined, status, join, progress, leaderboard, create |

## `hufi staking`

| # | Command | Description | Options | Tested? |
|---|---|---|---|---|
| 23 | `hufi staking status` | Check staking status | `-c <chain>`, `-a <addr>`, `--json` | [x] shows balance/staked/available/locked/min stake/lock period, `--json` returns full object |
| 24 | `hufi staking stake` | Stake HMT | `-a <amount>` (req), `-c <chain>`, `--json` | [ ] |
| 25 | `hufi staking unstake` | Initiate unstaking | `-a <amount>` (req), `-c <chain>`, `--json` | [ ] |
| 26 | `hufi staking withdraw` | Withdraw unlocked tokens | `-c <chain>`, `--json` | [ ] |
| 27 | `hufi staking deposit` | Show deposit address + QR | `-a <addr>`, `--json` | [x] shows QR code + address, `--json` returns address |
| 28 | `hufi staking --help` | Show staking subcommands | | [x] lists status, stake, unstake, withdraw, deposit |

## `hufi dashboard`

| # | Command | Description | Options | Tested? |
|---|---|---|---|---|
| 29 | `hufi dashboard` | Portfolio overview | `-c <chain>`, `--export csv\|json`, `--json` | [x] shows wallet, chain, staking, active campaigns |
