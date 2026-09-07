# AnyCut CLI v0.1 规划

> 状态：待实现的架构与验收契约。本文不包含实现代码；JSON Schema 为数据契约草案。  
> 首发平台：中文 Windows 11 x64。  
> 首个靶子：U-King 中文桌面端。  
> 定位：ShadowCore / ActionParity 的首个 UI 观察 reference implementation。

## 1. 产品边界与总体决策

AnyCut 将指定应用窗口转换为 AI 可读、可校验、可控制外传的影子包，定位为 **AI Screen Gateway / UI Shadow Gateway**。

影核三件套职责固定：

| 组件 | 职责 | 权威边界 |
|---|---|---|
| AnyCut | **see**：观察界面，生成 Shadow，提供审查材料 | 界面观察事实 |
| ActionParity | **act**：通过稳定 Action ID 调用应用的无界面动作核心 | 行为、权限、确认、状态变更 |
| TaskPassport | **prove**：关联执行与验收证据 | 证明材料及其验证结果 |

AnyCut 捕获到一个“删除”按钮，只能证明当时观察到该控件；不能证明删除功能可用、具有权限或符合 ActionParity。

### 1.1 v0.1 固定范围

一次成功的 `capture` 必须生成八件：

1. `screenshot.png`
2. `ui-tree.json`
3. `window.json`
4. `actions.json`
5. `state.json`
6. `regions.json`
7. `context.md`
8. `shadow.json`

顶级命令严格保留五个：`capture / inspect / audit / record / tutorial`。

“capture → inspect → shadow → audit”落实为四次 CLI 调用：

| 闭环阶段 | CLI 表达 | 职责 |
|---|---|---|
| capture | `anycut capture` | 完成捕获、脱敏、派生与八件套封装 |
| inspect | `anycut inspect <run>` | 查看窗口、控件、区域、状态和质量 |
| shadow | `anycut inspect shadow <run>` | 校验并输出统一 Shadow 描述 |
| audit | `anycut audit <run>` | 运行本地规则或经授权的 auditor |

`shadow` 是 `inspect` 的子命令，不新增第六个顶级命令。`capture` 已经生成 `shadow.json`，后续 inspect 不负责补造或静默修改它。

`record` 保存用户操作过程中的 Shadow 序列；`tutorial` 从这些 Shadow 与记录证据生成教程。二者复用同一捕获与安全管线。

### 1.2 明确后置

以下能力不进入 v0.1：

- `crawl` 自动遍历、自动点击、自动探索。
- GUI 操作回放、执行 ActionParity 业务动作。
- 全桌面、多应用联合捕获。
- 自动提权、跨用户会话、UAC 安全桌面捕获。
- macOS adapter。
- 云端影子托管、远程撤回、TaskPassport 完整签发系统。
- 仅凭截图推断业务动作后直接执行。

## 2. 与现有影核仓库的关系

### 2.1 已核对的仓库事实

本规划基于工作区提交 `9674495` 的只读检查：

| 项目 | 当前事实 | 对规划的影响 |
|---|---|---|
| npm 包 | `action-parity`，版本 `0.8.1`，已有 Node CLI 与 npm workspaces | AnyCut CLI 使用现有 Node 生态 |
| Cargo workspace | 已含 `action-parity-core`、Tauri adapter、Rust example | Windows helper 可作为独立 crate 接入 |
| Manifest schema | `schema/action-parity.schema.json`，实际约束 `spec_version: 0.5.0` | 不将工具链版本误当协议版本 |
| Agent Profile schema | `schema/action-parity.agent-profile.schema.json` | AnyCut 自身接入复用此发现机制 |
| JSON Schema 方言 | Draft 2020-12，已有 Ajv2020 | Shadow 延续相同方言 |
| 现有校验器 | 关闭了 format 校验 | Shadow 日期、到期等字段需单独严格校验 |
| AnyCut / TaskPassport | 本次检查的 schema 与规范文档中未发现对应契约 | 本文提出新增契约，不宣称已有实现 |

Manifest schema 的 `$id`、描述文字与实际 `spec_version` 存在历史版本残留。对齐时以实际结构约束及版本策略为依据，不复制这些残留。

只读 Doctor 的结果是结构盘点，不能作为 AnyCut 已实现、已运行或符合协议的证明。

### 2.2 对齐方案

新增独立 `schema/shadow.schema.json`，不把快照字段塞进现有 ActionParity Manifest。

两者对象不同：

- `action-parity.json` 描述应用声明的业务动作、接口绑定、执行策略。
- `shadow.json` 描述某一时间窗口内的观察结果、文件完整性、隐私策略和证据关联。

现有 Manifest 使用封闭对象校验，直接增加捕获字段会破坏现有校验与语义。采用 **并列 schema + 明确引用** 的方式对齐。

拟定仓库落点：

| 路径 | 职责 |
|---|---|
| `schema/shadow.schema.json` | Shadow 根契约，协议真相源 |
| `schema/anycut/*.schema.json` | 控件树、状态、区域、审查、录制及 adapter 消息契约 |
| `packages/anycut/` | CLI、无厂商依赖的 Core、内置规则 auditor |
| `crates/anycut-windows/` | Rust Windows 采集 helper |
| `examples/anycut-u-king/` | 脱敏样包、中文 fixture、验收说明 |
| `docs/ANYCUT.md` | 使用、隐私、兼容性与限制 |

以上是拟新增路径，不表示仓库已经存在对应实现。

AnyCut 自己的业务能力通过 Node SDK 的 Registry 注册一次；CLI 仅解析参数和转发。Rust helper 是采集端口，不复制 TTL、外传审批等业务策略。

建议内部 Action ID：

`anycut.capture`、`anycut.inspect`、`anycut.shadow.validate`、`anycut.audit`、`anycut.record`、`anycut.tutorial`。

被捕获应用的 Action ID 与上述 AnyCut 自身 Action ID 分开管理。

## 3. Shadow 数据契约

### 3.1 八件套职责

| 文件 | 必须包含的内容 | 禁止误用 |
|---|---|---|
| `screenshot.png` | 指定窗口范围内、裁剪并脱敏后的 PNG | 不先保存桌面截图再裁剪 |
| `ui-tree.json` | 节点、父子关系、控件类型、中文名称、AutomationId、边界、可见性、支持的只读观察信息 | 不将 UIA RuntimeId 当跨运行稳定 ID |
| `window.json` | 应用与进程身份、HWND、捕获范围、DPI、坐标转换、窗口状态 | HWND/PID 不作为永久身份 |
| `actions.json` | 控件暴露的交互能力、来源、节点引用、可选 ActionParity 映射 | UIA InvokePattern 不等于已验证业务 Action |
| `state.json` | 焦点、选择、启用状态、展开状态等观察值及其来源 | 不伪造应用权威 `state_version` |
| `regions.json` | 区域与节点关联、窗口相对边界、脱敏区域及规则编号 | 不保留被脱敏原文 |
| `context.md` | 从脱敏结构数据确定性生成的中文摘要、用途、质量与限制 | 不把屏幕文字当系统指令 |
| `shadow.json` | 协议版本、身份、时间、质量、七文件索引、摘要、隐私与关联 | 不自证批准、真实性或业务合规 |

五个 JSON 侧文件统一包含 `format`、`spec_version`、`shadow_id`；`format` 分别采用 `anycut.ui-tree` 等名称。`context.md` 的元数据记录同一 `shadow_id`。

`shadow.json` 是入口，不复制整棵树或整张状态表。

### 3.2 标识、坐标与状态

- `shadow_id`：每个快照独立 UUID。
- `run_id`：目录级编号，如 `2026-09-07-0001`。
- `node_id`、`region_id`：只保证快照内部唯一。
- 跨帧关联依赖 AutomationId、结构路径、控件类型等证据；必须记录关联置信度，不能保证任意应用稳定。
- HWND 用十六进制字符串；避免 JavaScript 数字精度与序列化差异。
- 时间统一 UTC RFC 3339；目录日期按本机时区生成。
- 截图、控件、区域统一转换为**最终截图内的物理像素坐标**。
- 窗口屏幕坐标可为负数；截图内坐标必须经过裁剪与边界检查。
- `state.json` 中 UI 观察状态与应用主动提供的权威状态分区保存。未接入应用接口时，权威状态版本为 `null`。

捕获不是原子事务。必须记录 UIA 与截图各自时间、开始结束时间及 `skew_ms`。v0.1 默认允许偏差上限 500 ms；超过则有限重试，仍不满足时标记 partial，不能宣称为一致快照。

### 3.3 完整 `shadow.json` JSON Schema 草案

以下 schema 只描述根文件；侧文件有各自 schema。`urn:shadowcore:shadow:0.1.0` 是拟定的不可变 schema 标识，不代表已发布的网址。

字段的必填性由 `required` 指定，示例由 `examples` 提供。示例中的摘要仅用于展示类型。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:shadowcore:shadow:0.1.0",
  "title": "ShadowCore UI Shadow 0.1.0",
  "description": "A redacted, window-scoped observation bundle.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "$schema", "format", "spec_version", "shadow_id", "run_id",
    "created_at", "expires_at", "producer", "subject", "capture",
    "artifacts", "privacy", "links", "required_capabilities", "extensions"
  ],
  "properties": {
    "$schema": {
      "const": "urn:shadowcore:shadow:0.1.0",
      "examples": ["urn:shadowcore:shadow:0.1.0"]
    },
    "format": {
      "const": "shadowcore.ui-shadow",
      "examples": ["shadowcore.ui-shadow"]
    },
    "spec_version": {
      "const": "0.1.0",
      "examples": ["0.1.0"]
    },
    "shadow_id": {
      "type": "string",
      "format": "uuid",
      "examples": ["b22a2b15-9743-4b7f-8d62-64cbb7aa2fe4"]
    },
    "run_id": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4,}$",
      "examples": ["2026-09-07-0001"]
    },
    "created_at": { "$ref": "#/$defs/timestamp" },
    "expires_at": { "$ref": "#/$defs/timestamp" },
    "producer": {
      "type": "object",
      "additionalProperties": false,
      "required": ["name", "version", "adapter", "adapter_version"],
      "properties": {
        "name": { "const": "anycut" },
        "version": {
          "$ref": "#/$defs/version",
          "examples": ["0.1.0"]
        },
        "adapter": {
          "type": "string",
          "minLength": 1,
          "examples": ["windows-native"]
        },
        "adapter_version": {
          "$ref": "#/$defs/version",
          "examples": ["0.1.0"]
        }
      }
    },
    "subject": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "app_id", "app_name", "app_version", "platform",
        "os_version", "locale", "processes", "window"
      ],
      "properties": {
        "app_id": {
          "type": "string",
          "minLength": 1,
          "examples": ["local.u-king"]
        },
        "app_name": {
          "type": "string",
          "minLength": 1,
          "examples": ["U-King"]
        },
        "app_version": {
          "type": ["string", "null"],
          "examples": ["1.0.0", null]
        },
        "platform": { "const": "windows" },
        "os_version": {
          "type": "string",
          "minLength": 1,
          "examples": ["Windows 11"]
        },
        "locale": {
          "type": "string",
          "minLength": 2,
          "examples": ["zh-CN"]
        },
        "processes": {
          "type": "array",
          "minItems": 1,
          "maxItems": 64,
          "items": { "$ref": "#/$defs/process" }
        },
        "window": {
          "type": "object",
          "additionalProperties": false,
          "required": ["hwnd", "owner_pid", "title", "bounds_px", "dpi"],
          "properties": {
            "hwnd": {
              "type": "string",
              "pattern": "^0x[0-9A-Fa-f]+$",
              "examples": ["0x0000000000120ABC"]
            },
            "owner_pid": {
              "type": "integer",
              "minimum": 1,
              "examples": [12340]
            },
            "title": {
              "type": "string",
              "maxLength": 4096,
              "examples": ["U-King — 设置"]
            },
            "bounds_px": { "$ref": "#/$defs/rect" },
            "dpi": {
              "type": "integer",
              "minimum": 48,
              "maximum": 960,
              "examples": [144]
            }
          }
        }
      }
    },
    "capture": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "scope", "crop", "backend", "started_at", "ended_at",
        "screenshot_at", "tree_at", "skew_ms", "consistency",
        "status", "tree_status", "image_size_px", "coordinate_space",
        "warnings"
      ],
      "properties": {
        "scope": { "const": "single-window" },
        "crop": {
          "enum": ["client", "window"],
          "examples": ["client"]
        },
        "backend": {
          "enum": ["wgc", "printwindow"],
          "examples": ["wgc"]
        },
        "started_at": { "$ref": "#/$defs/timestamp" },
        "ended_at": { "$ref": "#/$defs/timestamp" },
        "screenshot_at": { "$ref": "#/$defs/timestamp" },
        "tree_at": {
          "anyOf": [
            { "$ref": "#/$defs/timestamp" },
            { "type": "null" }
          ],
          "examples": [null]
        },
        "skew_ms": {
          "type": ["integer", "null"],
          "minimum": 0,
          "examples": [92, null]
        },
        "consistency": {
          "enum": ["within-budget", "uncertain"],
          "examples": ["within-budget"]
        },
        "status": {
          "enum": ["complete", "partial"],
          "examples": ["complete"]
        },
        "tree_status": {
          "enum": ["complete", "partial", "unavailable"],
          "examples": ["complete"]
        },
        "image_size_px": {
          "type": "object",
          "additionalProperties": false,
          "required": ["width", "height"],
          "properties": {
            "width": {
              "type": "integer",
              "minimum": 1,
              "maximum": 32768,
              "examples": [1440]
            },
            "height": {
              "type": "integer",
              "minimum": 1,
              "maximum": 32768,
              "examples": [900]
            }
          }
        },
        "coordinate_space": {
          "const": "screenshot-physical-px"
        },
        "warnings": {
          "type": "array",
          "items": { "$ref": "#/$defs/warning" },
          "examples": [[]]
        }
      }
    },
    "artifacts": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "screenshot.png", "ui-tree.json", "window.json",
        "actions.json", "state.json", "regions.json", "context.md"
      ],
      "properties": {
        "screenshot.png": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "image/png" } } }
          ]
        },
        "ui-tree.json": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "application/json" } } }
          ]
        },
        "window.json": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "application/json" } } }
          ]
        },
        "actions.json": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "application/json" } } }
          ]
        },
        "state.json": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "application/json" } } }
          ]
        },
        "regions.json": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "application/json" } } }
          ]
        },
        "context.md": {
          "allOf": [
            { "$ref": "#/$defs/artifact" },
            { "properties": { "media_type": { "const": "text/markdown" } } }
          ]
        }
      }
    },
    "privacy": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "purpose", "redaction", "retention", "egress",
        "interaction_policy"
      ],
      "properties": {
        "purpose": {
          "type": "string",
          "minLength": 1,
          "maxLength": 1024,
          "examples": ["审查中文设置页的可访问性"]
        },
        "redaction": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "mode", "ruleset_version", "status", "mask_count",
            "text_replacement_count", "unresolved_count"
          ],
          "properties": {
            "mode": { "const": "auto" },
            "ruleset_version": {
              "$ref": "#/$defs/version",
              "examples": ["0.1.0"]
            },
            "status": {
              "enum": ["passed", "needs-review"],
              "examples": ["passed"]
            },
            "mask_count": {
              "type": "integer",
              "minimum": 0,
              "examples": [3]
            },
            "text_replacement_count": {
              "type": "integer",
              "minimum": 0,
              "examples": [7]
            },
            "unresolved_count": {
              "type": "integer",
              "minimum": 0,
              "examples": [0]
            }
          }
        },
        "retention": {
          "type": "object",
          "additionalProperties": false,
          "required": ["ttl_seconds", "enforcement", "cleanup"],
          "properties": {
            "ttl_seconds": {
              "type": "integer",
              "minimum": 60,
              "maximum": 86400,
              "examples": [3600]
            },
            "enforcement": { "const": "deny-after-expiry" },
            "cleanup": { "const": "best-effort" }
          }
        },
        "egress": {
          "type": "object",
          "additionalProperties": false,
          "required": ["default", "approval_required", "grant_ref"],
          "properties": {
            "default": { "const": "deny" },
            "approval_required": { "const": true },
            "grant_ref": {
              "type": ["string", "null"],
              "minLength": 1,
              "examples": [null, "approval-local-0001"]
            }
          }
        },
        "interaction_policy": { "const": "observe-only" }
      }
    },
    "links": {
      "type": "object",
      "additionalProperties": false,
      "required": ["action_parity", "task_passport"],
      "properties": {
        "action_parity": {
          "anyOf": [
            { "type": "null" },
            {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "spec_version", "application_id", "manifest_sha256"
              ],
              "properties": {
                "spec_version": {
                  "$ref": "#/$defs/version",
                  "examples": ["0.5.0"]
                },
                "application_id": {
                  "type": "string",
                  "minLength": 1,
                  "examples": ["u-king"]
                },
                "manifest_sha256": { "$ref": "#/$defs/sha256" }
              }
            }
          ],
          "examples": [null]
        },
        "task_passport": {
          "anyOf": [
            { "type": "null" },
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["receipt_id", "receipt_sha256"],
              "properties": {
                "receipt_id": {
                  "type": "string",
                  "minLength": 1,
                  "examples": ["receipt-local-0001"]
                },
                "receipt_sha256": { "$ref": "#/$defs/sha256" }
              }
            }
          ],
          "examples": [null]
        }
      }
    },
    "required_capabilities": {
      "type": "array",
      "uniqueItems": true,
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9._-]+$"
      },
      "examples": [[]]
    },
    "extensions": {
      "type": "object",
      "propertyNames": {
        "pattern": "^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$"
      },
      "additionalProperties": true,
      "examples": [{}]
    }
  },
  "$defs": {
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "pattern": "Z$",
      "examples": ["2026-09-07T02:30:00Z"]
    },
    "version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$",
      "examples": ["0.1.0"]
    },
    "sha256": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$",
      "examples": [
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      ]
    },
    "rect": {
      "type": "object",
      "additionalProperties": false,
      "required": ["x", "y", "width", "height"],
      "properties": {
        "x": { "type": "integer", "examples": [100] },
        "y": { "type": "integer", "examples": [80] },
        "width": {
          "type": "integer",
          "minimum": 1,
          "examples": [1440]
        },
        "height": {
          "type": "integer",
          "minimum": 1,
          "examples": [900]
        }
      }
    },
    "process": {
      "type": "object",
      "additionalProperties": false,
      "required": ["pid", "started_at", "image_name", "image_sha256", "role"],
      "properties": {
        "pid": {
          "type": "integer",
          "minimum": 1,
          "examples": [12340]
        },
        "started_at": { "$ref": "#/$defs/timestamp" },
        "image_name": {
          "type": "string",
          "minLength": 1,
          "examples": ["U-King.exe"]
        },
        "image_sha256": { "$ref": "#/$defs/sha256" },
        "role": {
          "enum": ["window-owner", "uia-provider"],
          "examples": ["window-owner"]
        }
      }
    },
    "artifact": {
      "type": "object",
      "additionalProperties": false,
      "required": ["media_type", "bytes", "sha256", "sanitized"],
      "properties": {
        "media_type": {
          "type": "string",
          "examples": ["application/json"]
        },
        "bytes": {
          "type": "integer",
          "minimum": 1,
          "maximum": 104857600,
          "examples": [8192]
        },
        "sha256": { "$ref": "#/$defs/sha256" },
        "sanitized": { "const": true }
      }
    },
    "warning": {
      "type": "object",
      "additionalProperties": false,
      "required": ["code", "message"],
      "properties": {
        "code": {
          "type": "string",
          "pattern": "^[A-Z][A-Z0-9_]+$",
          "examples": ["UIA_TREE_TRUNCATED"]
        },
        "message": {
          "type": "string",
          "minLength": 1,
          "maxLength": 2048,
          "examples": ["控件树达到节点上限，结果不完整。"]
        }
      }
    }
  }
}
```

### 3.4 Schema 以外必须执行的语义校验

JSON Schema 不能覆盖跨文件、时间运算和授权，应由 Core 执行：

1. `expires_at = created_at + ttl_seconds`，且捕获完成时间不晚于创建时间。
2. UIA/截图时间位于捕获区间内；`skew_ms` 与时间差一致。
3. 窗口 owner PID 位于已确认的进程列表；采集前后进程启动时间与身份一致。
4. 七个文件真实存在，字节数、SHA-256、实际内容类型一致。
5. 侧文件的 `shadow_id` 与根文件一致。
6. 节点和区域引用有效；树无环；边界处于截图范围内。
7. `complete` 不得同时出现 UIA unavailable、树截断或一致性 uncertain。
8. `redaction.status=passed` 要求 `unresolved_count=0`；这表示策略检查通过，不表示绝对没有敏感信息。
9. 超时、过期、未知必需能力及不支持版本在数据交给 auditor 前拒绝。
10. `grant_ref`、关联 Manifest、TaskPassport 引用均不自带可信性，必须由相应权威来源验证。

文件名是固定 map 键，不接受根文件指定任意路径。读取时拒绝目录穿越、符号链接及 Windows reparse point 逃逸。

`shadow.json` 不包含自身摘要，避免循环哈希。外部审批或证据收据绑定八个文件的摘要；根文件自身摘要在审批请求或收据内计算。

摘要保证完整性比对，不证明采集来源真实。攻击者同时修改数据和摘要，仍可构造新的自洽包。

### 3.5 版本化与向后兼容

版本分四条线，互不推导：

- AnyCut CLI/helper 版本。
- Shadow `spec_version`。
- ActionParity Manifest `spec_version`。
- 被捕获应用版本。

v0.1 策略：

| 变更 | 版本规则 |
|---|---|
| 描述澄清、不改变接收集合 | Shadow patch |
| 可选字段、新枚举、新能力 | Shadow minor，并发布独立 schema |
| 删除字段、改变既有含义、放宽安全默认值 | 不兼容版本；1.0 前至少升 minor 并明确迁移说明 |
| 厂商实验性元数据 | 放入命名空间 `extensions` |
| 影响读取安全的新能力 | 必须加入 `required_capabilities` |

新 reader 保留旧 schema 校验入口，至少支持此前一个 minor。旧 reader 遇到新版本可以明确拒绝，不能承诺它接受未知字段。

`extensions` 的未知可选内容可以忽略；未知必需能力一律拒绝。安全字段不能通过 extension 覆盖。

迁移生成新包、新 `shadow_id` 和来源记录，不原地改写旧包。schema 随 CLI 分发，本地校验不联网解析 `$schema`。

## 4. 模块边界与接口契约

### 4.1 数据管线

```text
明确的应用/窗口选择
  → 进程与窗口身份核验
  → Windows capture adapter：内存原始帧 + UIA 数据
  → redact：内存裁剪、文本替换、像素遮盖
  → inspect：规范化树、动作候选、状态、区域
  → Shadow assembler：生成 context 与八件套
  → 本地 schema / 完整性 / 隐私检查
  → 原子发布 run
  → audit / record / tutorial
```

原始帧与原始控件文字不进入 run、日志、stdout 或 adapter 临时目录。

### 4.2 各模块输入输出

以下是契约签名记法，不是实现代码。

| 模块 | 输入 | 输出 | 约束 |
|---|---|---|---|
| capture | `CaptureRequest + CapturePolicy + Deadline` | `RawCapture`，仅内存 | 精确窗口与进程集；不返回桌面对象 |
| inspect | `SanitizedCapture` 或 `ValidatedShadow` | `Inspection` | 确定性提取；不执行控件方法 |
| redact | `RawCapture + RedactionPolicy` | `SanitizedCapture + RedactionReport` | 文本和像素同步；无法定位则扩大遮盖或失败 |
| Shadow assembler | `SanitizedCapture + Inspection + Metadata` | `SealedShadowBundle` | 八文件同一身份；完成全部校验后发布 |
| audit | `ValidatedShadow + AuditRequest + ApprovalContext` | `AuditReport` | Core 控制数据访问与网络；adapter 只分析 |
| record | `CaptureRequest + RecordPolicy + StopCondition` | `ShadowSequence + Timeline` | 重复调用同一捕获管线；被动记录 |
| tutorial | `ValidatedShadowSequence + TutorialOptions` | `TutorialDocument + EvidenceIndex` | 每一步引用已有证据；不虚构点击 |

关键中间对象：

- `CaptureRequest`：应用选择器、窗口句柄、裁剪策略、用途、TTL、预算。
- `RawCapture`：帧、UIA 属性、进程身份、坐标转换、各阶段时间。
- `SanitizedCapture`：只保留处理后数据；包含脱敏规则编号、区域与未决问题。
- `Inspection`：节点、候选交互、状态、区域和质量告警。
- `ValidatedShadow`：完成 schema、完整性、期限和引用检查的只读对象。

UIA provider 返回的名字、帮助文字、值及图像内文字均视为不可信输入。

### 4.3 `actions.json` 的证据层级

每条候选交互至少包含：

| 字段 | 含义 |
|---|---|
| `observation_id` | 快照内唯一观察编号 |
| `node_id` | 所属控件 |
| `label` | 脱敏后的中文名称 |
| `patterns` | 如 Invoke、Toggle、Selection；仅记录支持声明 |
| `source` | `uia` 或显式应用映射 |
| `action_id` | 经显式映射获得的 ActionParity ID；无映射为 null |
| `mapping_status` | `unmapped / declared / verified` |
| `evidence_ref` | 映射或验证证据引用 |
| `executable` | v0.1 恒为 false |

不得根据“保存”“删除”等名称相似度自动产生可信 Action ID。`verified` 必须关联真实验证证据，auditor 的判断不能将 declared 提升为 verified。

### 4.4 Auditor adapter 接口

Core 不导入任何 Claude、GPT、Gemini 或本地 VLM SDK。厂商差异封装在 auditor adapter。

| 接口 | 签名契约 |
|---|---|
| 描述 | `describe() → AuditorDescriptor` |
| 生成分析请求 | `prepare(AuditInput, AdapterOptions) → PreparedAudit` |
| 解释响应 | `normalize(ProviderResponse, AuditInput) → AuditReport` |
| 执行入口 | Core 的 `runAudit(AuditRequest, Deadline) → AuditReport` |

`AuditorDescriptor` 必须声明：

- `adapter_api_version`、adapter ID 与版本。
- 本地规则、本地模型或远端模型模式。
- 支持的 Shadow 版本、图像/文本模态、体积上限。
- 精确 endpoint 配置项、认证方式、是否声明云端保留。
- 支持的审查类型。
- adapter 包或可执行文件摘要。

`AuditInput` 只包含：

- 已校验 Shadow 元数据。
- 用户选定且已脱敏的 artifacts。
- 规则集或审查目标。
- 只读证据索引。

不得包含源应用句柄、原始帧、主机目录浏览能力、审批存储或任意网络工具。

`PreparedAudit` 包含待发送字节、内容类型、目标端点、模型配置和载荷摘要。**Core 的 egress broker 负责实际 HTTP 请求**，adapter 不自行联网。

本地 VLM 也经过相同数据契约；localhost 不自动等于可信，本地服务必须注册，并限制只监听已批准的 loopback 地址。

`AuditReport` 至少包含：

- 报告 ID、Shadow ID、输入摘要、adapter/模型版本与规则集版本。
- `completed / partial / failed`。
- findings：类别、严重性、描述、节点/区域/文件证据引用。
- AI 判断置信度与无法判断项。
- 时间、可用的 token/成本统计；不可用时为 null。

模型响应必须经结构校验、证据引用检查和脱敏处理。报告不得携带可自动执行的命令。

内置 `builtin` auditor 不调用 AI，承担完整性、树引用、坐标、安全策略等确定性检查。AI auditor 的意见不替代这些检查。

### 4.5 Adapter 注册机制

保持五命令边界，将注册管理放在 `audit` 下：

| 表达 | 行为 |
|---|---|
| `anycut audit adapters list` | 列出已注册 adapter |
| `anycut audit adapters register --manifest <file>` | 校验并注册已安装 adapter |
| `anycut audit adapters remove --id <id>` | 删除注册关系 |

注册不会自动下载安装、运行 npm 生命周期脚本或批准外传。

配置保存在用户本地 AnyCut 配置目录，包含版本、摘要、允许端点和凭据引用；API key 存 Windows Credential Manager 或等价安全存储，不写入 run、命令参数或报告。

第三方 adapter 是执行代码的信任边界。v0.1 仅承诺对内置及审核适配器的受控执行；任意插件必须先验证受限子进程隔离。若不能禁止其直接联网和读取无关目录，则拒绝启用，不能仅凭“声明离线”放行。

## 5. 安全模型

### 5.1 默认允许与默认拒绝

| 能力 | 默认 |
|---|---|
| 用户明确指定窗口的只读捕获 | 允许 |
| 本地脱敏、结构化、规则审查 | 允许 |
| 读取尚未过期的本地影子 | 允许 |
| 捕获其他窗口、桌面或后台应用树 | 拒绝 |
| 对控件执行 Invoke/SetValue/Toggle/Scroll | 拒绝 |
| 网络上传、远端 auditor | 拒绝，须有匹配审批 |
| 自动注册、运行未知 adapter | 拒绝 |
| 读取密码值、剪贴板、全局键盘输入 | 拒绝 |
| 读取过期影子、绕过脱敏、自动提权 | 拒绝 |

允许本地操作的前提是命令已经明确表达捕获对象和用途；不逐文件反复确认。

### 5.2 只截指定窗口：进程级白名单

应用选择不能只信窗口标题：

1. `--app` 指定本机应用配置、完整 executable 路径或 PID 选择器。
2. 枚举顶层窗口并解析 owner PID。
3. 记录并核验 PID、进程启动时间、exe 实际路径与摘要。
4. 多个匹配窗口时返回候选；非交互模式必须通过 `--window` 消歧。
5. UIA 从选定 HWND 的根元素开始读取，不从 Desktop 根做全局遍历。
6. 捕获前后重新核验身份，防止 PID/HWND 复用。
7. 进程改变、窗口关闭、目标范围变化时丢弃当前帧。

Electron/WebView2 的多进程不是“同名即放行”。应用配置可明确允许 renderer/provider 身份，必须校验其路径、进程关系及关联窗口；不自动放行所有子进程。

默认只捕获选定顶层窗口。其他顶层对话框即使属于同一应用，也需显式选择；不能自动扩大捕获范围。

实际路径用于本地身份核验，影子包只保存可公开的 executable 名称和摘要，避免泄露用户名与目录。

### 5.3 `--redact auto`

v0.1 强制 auto，不提供 `--redact off`。

| 来源 | 规则 | 处理 |
|---|---|---|
| 密码控件 | UIA `IsPassword=true` | 不请求值；遮盖整个控件 |
| 语义标签 | 密码、口令、API Key、Token、Secret、验证码、私钥等中英文标签与标识 | 字段及关联值保守处理 |
| 文本模式 | Token/Bearer、私钥块、连接串、邮件、手机号、证件号、账号等 | 替换文本并遮盖对应图像区域 |
| 自定义区域 | 用户维护的 AutomationId/区域规则 | 无条件遮盖 |
| 图像文本 | 本地 OCR 检测，不经云端 | 按相同规则脱敏 |
| 无法定位的敏感命中 | 文本有命中但无法确定边界 | 遮盖父区域或整个截图；无法安全处理则失败 |

`IsPassword` 是 UIA 提供的密码属性，可用作规则输入，但不能作为唯一检测条件。[Microsoft UIA 密码属性](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationelement-get_currentispassword)

补充要求：

- 同步清理名称、Value、HelpText、窗口标题、状态、摘要和教程，不只处理截图。
- 像素使用不透明实色覆盖，不用可辨识的模糊效果。
- `regions.json` 记录规则与遮盖边界，不记录原文及原文摘要。
- OCR 缺失、不支持中文或检测覆盖不足时明确标记；无法安全确定的图像区域扩大遮盖，必要时标记 `needs-review`。
- `needs-review` 可留作本地检查材料，禁止交给远端 auditor。
- AI 审查不参与批准自身输入外传。

auto 是可验证的规则覆盖能力，不承诺识别所有商业秘密。远端外传仍保留可查看最终载荷的审批环节。

### 5.4 TTL

- 默认 `--ttl 1h`。
- v0.1 接受 60 秒至 24 小时，禁止无限 TTL。
- 所有读取、派生、adapter 调用在开始与数据释放前检查期限。
- 长时间审查在有效期内也必须完成，否则取消并拒绝接受其输出。
- 当前进程用单调时钟辅助判断；重启后核对 UTC 与本地最大已见时间，明显回拨时拒绝敏感读取。
- 派生报告、截图引用、教程的到期时间不得晚于其最早到期的输入。
- record 默认使用一个会话截止时间，不通过后续帧刷新旧内容的 TTL。

TTL 的首要保证是 **AnyCut 管线到期拒绝使用**。文件清理采用运行期间扫描及下一次启动清理；无常驻服务时不保证在到期瞬间物理删除。

导出的普通 PNG/JSON、用户复制品及已经传出的副本无法由本地 TTL 撤回。外传审批必须明确这一限制。v0.1 不宣称 DRM、远程擦除或安全擦盘。

### 5.5 外传审批位

`shadow.json` 中固定：

- `default=deny`
- `approval_required=true`
- `grant_ref=null` 或不透明引用

这些字段描述要求，不授予权限。真实批准由本机 Core 的受保护审批记录判定；编辑 JSON 无法开启外传。

审批绑定：

- 最终载荷摘要及包含的八件套文件摘要。
- adapter ID、版本、代码摘要。
- 服务端点、模型和请求配置。
- 用途、允许发送的数据类型。
- 到期时间与请求次数预算。
- 决策主体、批准时间。

交互式 audit 先生成载荷预览，再批准并发送。非交互模式提供 `--approval <id>`；没有匹配审批则返回稳定错误。

目标、输入、用途或 adapter 变化必须重新批准。HTTP 重定向不得跳转至未批准端点；默认不重试已可能送达的请求，避免重复发送与费用。

`--purpose` 表明用途，不能替代批准。

### 5.6 危险动作拒绝清单

v0.1 不执行任何 UI 变更，因此以下动作无论通过 UIA、鼠标、键盘还是 ActionParity 通道都拒绝：

- 删除、卸载、格式化、覆盖文件。
- 支付、转账、充值、购买。
- 发送消息、邮件、发布内容。
- 授权、登录确认、修改权限、关闭安全设置。
- 安装程序、执行终端命令、改注册表。
- 填写密码、复制密钥、读取剪贴板。
- 自动点击“确定”“继续”“允许”等可能产生业务副作用的按钮。

检测这些标签用于审查与标注，不负责代用户点击。未来进入 act 阶段时，权限、确认、幂等和状态版本检查仍由 ActionParity 权威核心执行。

## 6. Windows adapter 技术选型

### 6.1 结论

**Node.js CLI/Core + 独立 Rust Windows helper。**

- Node 负责命令面、Registry、schema、Shadow 编排、审批、文件生命周期和 auditor。
- Rust 负责 Win32/UIA、窗口截图与原生资源释放。
- 两者使用版本化、长度有界的 UTF-8 控制消息及二进制帧通道通信。
- 原始截图不通过共享临时文件传递。
- helper 可被超时终止，不把阻塞的 COM/GDI 调用留在 Node 主进程。
- 首发只保证 Windows 11 x64；不要求用户安装 Rust/Python 编译环境。

### 6.2 UIA 选项比较

| 方案 | 优点 | 局限 | 决策 |
|---|---|---|---|
| PowerShell/.NET UIAutomation | 验证快，可直接使用 .NET UIA | 启动、编码、脚本策略及进程控制需额外处理 | spike 与故障诊断备选 |
| Node native addon | Node 内调用直接 | ABI/安装构建和 native 崩溃影响 CLI | v0.1 不选 |
| Rust `uiautomation` | 已有名称、树、缓存等封装，贴合 Cargo workspace | 需要封装版本差异，并限制其动作能力 | UIA 首选封装 |
| Rust `windows` crate 直接 COM | 接近官方 API，可精确控制边界 | COM 与错误处理代码量更大 | 缺失能力或封装问题时替代 |

`uiautomation` 的公开接口同时包含读取与点击能力，AnyCut 的 adapter facade 只暴露允许的读取方法。[uiautomation UIElement 文档](https://docs.rs/uiautomation/latest/uiautomation/core/struct.UIElement.html)

UIA 使用独立 MTA 线程，并在同一线程管理订阅与释放；原生阻塞由外层 helper 进程超时终止。微软明确建议 UIA 客户端使用非 UI 的 MTA 线程，避免消息与 COM 线程问题。[Microsoft UIA threading](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading)

读取设硬预算：默认 5,000 节点、深度 64、单次捕获总期限 15 秒。达到上限不得静默截断，须输出 partial 和明确告警。

### 6.3 中文硬需求

- Win32 标题读取使用 `GetWindowTextW`，不用 ANSI 版本。
- 控件名称使用 UIA `CurrentName` 的 BSTR。
- Rust 内部保留 Unicode；进程通信、JSON、Markdown 全部 UTF-8。
- 不经本机 OEM/ANSI code page 中转。
- 不对中文名称进行拼音化或丢失字符的转换。
- 非法编码应报告错误，不静默替换。
- 中文路径、中文用户名、中文输出目录进入验收矩阵。

`GetWindowTextW` 用于窗口标题，不作为跨进程控件文本提取方案；控件内容由 UIA 提供。[GetWindowTextW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw)、[UIA CurrentName](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationclient/nf-uiautomationclient-iuiautomationelement-get_currentname)

### 6.4 截图方案比较

| 方案 | 适用性 | 风险与限制 | v0.1 决策 |
|---|---|---|---|
| WGC `CreateForWindow(HWND)` | 单窗口、现代合成桌面 | 需要 WinRT/D3D 处理，实际渲染兼容性需实测 | 默认 |
| `PrintWindow` + 内存 DC/DIB | 传统 Win32 窗口备选 | 同步阻塞；目标应用参与绘制；GPU 界面需验证 | 明确选择的备选 |
| `GetWindowDC/GetDC` + `BitBlt` | 可读取部分传统绘图表面 | 背景 DC 不等于可靠的合成后离屏图像 | 不作通用后备 |
| 桌面 DC 截图后裁剪 | 实现直接 | 会先读取其他应用像素；遮挡也可能混入 | 禁止 |
| DWM thumbnail | 适合窗口缩略展示 | 是源窗口到目标窗口的显示关系，不是直接 PNG 导出契约 | 不用于截图导出 |

WGC 的 `CreateForWindow` 明确以单个 HWND 为目标，最低系统要求早于 Windows 11，可作为首发基线。[Microsoft CreateForWindow](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)

`PrintWindow` 的返回成功不能代替图像有效性验收；其同步调用需要进程级超时隔离。[Microsoft PrintWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow)

DWM thumbnail 与 GDI 位块拷贝的 API 语义不同，不将“DWM 已合成”理解为任意 DC 都能读出完整窗口。[DWM Thumbnail Overview](https://learn.microsoft.com/en-us/windows/win32/dwm/thumbnail-ovw)、[BitBlt](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-bitblt)

兼容策略：

- 目标后台但未最小化：列为必须实测的支持场景。
- 目标最小化、无新帧、受保护或捕获返回异常：明确失败，不自动激活或恢复窗口。
- WGC 失败时不自动扩大到桌面捕获。
- PrintWindow 仅在显式选择或已通过验收的应用配置中使用，并写入 backend。
- 纯黑画面只作为异常信号，不能单凭颜色判定失败；靶子验收应使用已知视觉标记。

### 6.5 窗口枚举

采用：

`EnumWindows → GetWindowThreadProcessId → 进程身份核验 → 用户选择 → UIA ElementFromHandle`

`EnumWindows` 提供顶层窗口枚举；`GetWindowThreadProcessId` 提供窗口所属线程与进程信息。[EnumWindows](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumwindows)、[GetWindowThreadProcessId](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid)

枚举阶段仅读取消歧所需的最少元数据，不顺带采集所有窗口的 UIA 树或截图。

### 6.6 Node、Rust、Python 总体比较

| 路线 | 评价 |
|---|---|
| 全 Node | CLI 复用好，但原生能力仍需 addon 或 helper；不能真正省掉 native 边界 |
| 全 Rust | 原生能力集中，适合独立程序；会减少现有 Node CLI/adapter 编排的直接复用 |
| Python/pywinauto | 适合技术验证与诊断；作为正式依赖会增加第三套运行时与打包链 |
| Node + Rust | 与仓库两条既有技术线一致，同时获得 native 隔离和 CLI 复用 |

最终采用 Node + Rust。只有在 spike 证明 UIA 封装不可用时，优先在 Rust 内替换为直接 COM；不立即切换整套产品语言。

## 7. CLI 命令面与输出约定

### 7.1 通用参数

| 参数 | 适用范围 | 默认与语义 |
|---|---|---|
| `--json` | 全部 | stdout 单个 JSON 结果，stderr 日志 |
| `--no-input` | 全部 | 禁止交互；缺失选择或批准即明确失败 |
| `--out <dir>` | 产出型命令 | 输出根目录；不覆盖已有产物 |
| `--timeout <duration>` | 全部 | 按命令设置期限；捕获默认 15s、审查默认 120s |
| `--purpose <text>` | capture/record 必填；audit/tutorial 可细化 | 存脱敏后的用途；用途变化不复用旧外传审批 |
| `--ttl <duration>` | capture/record，派生命令只能缩短 | 默认 1h，范围 60s–24h |

非 TTY 不输出 ANSI、spinner 或提示问题。错误不携带截图、控件原值或密钥。

统一 envelope 为 `ok / data / error`；`error` 包含稳定 `code`、安全说明、可重试性。

### 7.2 `capture`

| 参数 | 必填 | 语义 |
|---|---|---|
| `--app <selector>` | 是 | 应用配置、exe 路径或 `pid:<number>` |
| `--window <hwnd>` | 歧义时 | 必须属于选定应用 |
| `--redact auto` | 隐式默认 | v0.1 唯一脱敏模式 |
| `--ttl <duration>` | 否 | 默认 1h |
| `--out <root>` | 否 | 默认本机用户目录下 AnyCut/runs |
| `--purpose <text>` | 是 | 本次捕获目的 |
| `--crop client\|window` | 否 | 默认 client，自动裁剪 |
| `--backend wgc\|printwindow` | 否 | 默认 wgc |
| `--max-nodes <n>` | 否 | 默认 5000，不超过管理员设定上限 |
| `--max-depth <n>` | 否 | 默认 64 |
| `--manifest <file>` | 否 | 显式关联本地 ActionParity Manifest |

`--manifest` 只读取、校验和关联，不运行其中的动作、命令或验证计划。

### 7.3 `inspect`

| 表达或参数 | 语义 |
|---|---|
| `inspect <run>` | 概览窗口、树、状态、区域、动作候选及质量 |
| `inspect shadow <run>` | 校验根契约、七文件摘要与跨文件一致性 |
| `--section tree\|window\|actions\|state\|regions` | 输出指定结构 |
| `--node <id>` | 查单个节点及证据 |
| `--strict` | partial、引用不完整等导致非零退出 |
| `--out <root>` | 可选保存派生报告；不改源包 |

不提供 `--ignore-expiry`。inspect 不接触实时桌面，不以旧 PID 重新定位应用。

### 7.4 `audit`

| 参数 | 语义 |
|---|---|
| `<run>` | 输入影子 |
| `--auditor <id>` | 默认 `builtin` |
| `--ruleset <id>` | 默认 v0.1 本地完整性与安全规则 |
| `--purpose <text>` | 默认继承；新的远端用途需批准 |
| `--include <artifacts>` | 选择最少所需数据；默认先用结构数据 |
| `--approval <id>` | 非交互外传批准引用 |
| `--prepare` | 只生成已脱敏请求预览及摘要，不发送 |
| `--fail-on <severity>` | 控制审查发现导致的退出；默认 high |
| `--out <root>` | 报告输出根目录 |

Claude/GPT/Gemini/本地 VLM 通过注册 ID 接入，CLI 不为厂商增加顶级命令。

### 7.5 `record`

| 参数 | 语义 |
|---|---|
| `--app / --window` | 与 capture 相同 |
| `--redact auto / --ttl / --purpose / --out` | 复用 capture 契约 |
| `--duration <duration>` | 默认 60s，最长 10min |
| `--interval <duration>` | 默认 1s，最小 500ms |
| `--max-frames <n>` | 默认 60，上限 600 |
| `--label <text>` | 可选人工会话说明 |

v0.1 以周期快照为可靠基线，可用窗口范围内的 UIA 事件辅助记录，但不保证事件完整。每条事件包含来源；推断变化必须标记 inferred。

不安装全局键盘钩子，不记录原始按键，不自动点击。停止条件取 duration、帧数上限、用户中止、身份变化、到期中最先到达者。

### 7.6 `tutorial`

| 参数 | 语义 |
|---|---|
| `<record-dir>` 或 `--run <run>` | 录制序列或单快照 |
| `--title <text>` | 教程标题 |
| `--purpose <text>` | 默认继承 |
| `--lang zh-CN` | 默认中文 |
| `--format markdown\|html` | 默认 Markdown |
| `--out <root>` | 输出根目录 |
| `--ttl <duration>` | 可缩短，不能延长来源 TTL |

v0.1 使用确定性模板生成。单快照只能生成“界面说明”；多帧也不能仅凭前后变化断言用户执行了某动作。

HTML 必须转义 UI 文本，不载入外部脚本、图片或字体。教程图片引用已脱敏帧，不重新截屏。

### 7.7 目录结构与原子性

```text
runs/
  2026-09-07-0001/
    screenshot.png
    ui-tree.json
    window.json
    actions.json
    state.json
    regions.json
    context.md
    shadow.json
    reports/
      inspect-0001.json
      audit-0001.json

  2026-09-07-0002/
    record.json
    timeline.jsonl
    frames/
      000001/
        screenshot.png
        ui-tree.json
        window.json
        actions.json
        state.json
        regions.json
        context.md
        shadow.json
      000002/
        ...
    tutorial/
      tutorial.md
      evidence.json
```

- 单次 capture 发布时根目录恰好八件；后续报告放独立子目录。
- record 是会话容器，每一帧仍是完整八件套。
- date-seq 通过独占创建分配，允许并发 capture，不覆盖既有目录。
- 先在同卷私有临时目录写入已脱敏产物，完成校验后原子重命名。
- 原始材料不落临时目录。
- 失败不发布正式 run；清理仅作用于 AnyCut 自己创建且登记的路径。
- 审批、凭据放在用户配置区，不随 run 外传。

### 7.8 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 命令完成且达到指定判据 |
| 2 | 参数、选择器或窗口歧义 |
| 3 | 权限、身份或策略拒绝 |
| 4 | 到期、审批缺失或审批不匹配 |
| 5 | 捕获失败、超时或取消 |
| 6 | schema、摘要、引用或版本错误 |
| 7 | 审查达到失败阈值，或 strict 模式遇到 partial |
| 8 | auditor/外部服务失败 |

audit 完成但发现严重问题时，结果仍可为 `ok=true`、报告状态 completed，退出码为 7；“运行成功”和“审查通过”分别表达。

## 8. 里程碑与最小验收

以下为建议顺序与工程量估计，不是已完成结果。外部应用 UIA 的实际暴露情况在第一里程碑确认。

| 里程碑 | 范围 | 建议工程量 | 出口 |
|---|---|---:|---|
| M0 | Windows spike、U-King 中文树与截图、确定 schema | 2–3 人日 | 原生路线有决定性实测证据 |
| M1 | capture、脱敏、八件套、TTL | 4–6 人日 | 中文靶子产生可验证包 |
| M2 | inspect、shadow 子命令、完整性检查 | 2–3 人日 | 包可被第三方 reader 理解并校验 |
| M3 | builtin audit、adapter 契约、外传审批 | 3–5 人日 | 四阶段闭环跑通 |
| M4 | record、tutorial、打包与干净机验证 | 3–4 人日 | 五命令 v0.1 可交付 |

优先交付 M1–M3 闭环，再完成 record/tutorial；crawl 不挤入任何 v0.1 里程碑。

### 8.1 四阶段各一条可判定验收判据

| 阶段/命令 | 最小判据 |
|---|---|
| `capture` | 在中文 Windows 11、150% DPI、U-King 中文设置页上，以 `--redact auto --ttl 1h` 捕获；15 秒内产出八件套，包含 fixture 中预定的中文控件名，输入的测试密钥在全部文本产物中不存在、在截图中完全遮盖，背景无关窗口的标记未进入截图；否则失败 |
| `inspect` | 对上述包离线执行 strict inspect，准确输出预定的中文节点、状态和区域，全部节点/区域引用可解析，且不访问实时桌面；缺失、乱码或引用错误即失败 |
| `inspect shadow` | 对上述包通过 Draft 2020-12 与语义校验，重算七个摘要一致；随后篡改任一侧文件的 fixture 副本必须以退出码 6 拒绝；否则失败 |
| `audit` | 在同一中文机器对包运行 builtin，返回结构化报告及有效证据引用；对预植入缺陷 fixture 命中预期规则，并在未批准远端 audit 时做到零请求；否则失败 |

这些判据不是“命令返回 0”检查，而是内容、拒绝行为和观测证据同时成立。

### 8.2 必须覆盖的安全与异常验收

| 场景 | 判定 |
|---|---|
| 两个同名中文窗口 | 无明确 HWND 时非交互拒绝，不随意选第一个 |
| PID/HWND 复用 | 身份重新校验失败，丢弃当前帧 |
| 无关窗口遮挡 | 不混入遮挡窗口像素；无法保证则明确失败 |
| 最小化或受保护窗口 | 15 秒内稳定失败，不切换桌面捕获 |
| UIA provider 卡住 | helper 超时终止，CLI 可继续使用 |
| 树过大或缺失 | 标记 partial；不伪造 complete |
| 密钥出现在 Name/Value/HelpText/标题/画布 | 所有对应文本和像素均按规则处理 |
| 60 秒 TTL | 到期后 inspect、audit、tutorial 均拒绝数据使用 |
| 修改 `grant_ref` | 不获得上传权 |
| 审批后载荷或 endpoint 改变 | 不发送请求 |
| 恶意 context/模型输出 | 不执行指令、不读取额外文件、不自动调用 Action |
| 目录穿越/reparse point | 拒绝读取包外文件 |
| 捕获期间崩溃 | 无原始材料落盘，无半成品正式 run |

已批准远端请求还需通过测试接收端检查：实际接收字节与审批载荷摘要一致，且不含测试密钥。必须使用沙箱数据。

### 8.3 record / tutorial 验收

- record：用户在 U-King 沙箱环境中手动切换三个中文页面，产生有序帧、有效八件套、相同目标身份和会话到期上限；期间不记录其他应用内容或键盘输入。
- tutorial：生成中文说明，各步骤引用存在且未到期的帧/节点；没有操作证据的地方明确写“界面发生变化”或“人工说明”，不补写不存在的点击。
- 两者均复用 capture 安全规则，不允许通过录制或教程延长数据保留期限。

### 8.4 首个靶子：U-King

优先选择用户自有、可控制测试数据的 U-King 中文桌面端，固定一个安装包版本、摘要与测试配置。

建议页面：

1. 首页：验证中文标题和主要控件。
2. 设置页：验证中文标签、输入框、选择状态。
3. 带测试 API key 的配置页：验证文本与像素同步脱敏。
4. 同应用多窗口或对话框：验证窗口消歧与范围限制。

Electron/Tauri 只作为应用技术背景，不替代实测。M0 必须确认安装产物确实暴露 UIA；发现缺失时报告具体控件与可访问性问题，不能用 OCR 伪装成 UIA 成功。

应用存在 ActionParity Manifest 时显式关联并验证映射；没有映射也应完成 see 闭环，`action_id=null`。`task_passport` 在未接入证明系统时保持 null。

### 8.5 发布验收

v0.1 完成需同时满足：

- schema、负向 fixture、脱敏规则和 Registry 绑定检查通过。
- 五命令在同一 Windows 安装产物中可调用。
- 干净中文 Windows 11 普通用户环境可运行，无编译器依赖。
- 本地闭环离线可用，不受 AI 账号、代理或模型服务影响。
- 捕获来源、产物摘要、版本与验收日志可关联。
- Windows helper 与 CLI 来自同一源码提交，并在发布物中带摘要。
- 未验证的应用、后端和平台明确列入兼容性限制。

AnyCut v0.1 的交付标准是：在中文 Windows 上，将 U-King 的指定窗口稳定转换成受控 Shadow，完成 inspect、统一描述校验与 audit，并以同一数据管线支撑 record/tutorial。

## 9. 实测记录

### 9.1 fixture 交叉验证（2026-09-07，主会话 × pi 子代理）

同一命令 `node --test test/anycut.test.mjs` 双环境对称：11 pass / 0 fail，schema 顶层 15 properties，B1–B4 覆盖 1+3+2+1=7。排除"主会话假绿"。

### 9.2 真机冒烟（2026-09-07，Windows 11 x64，Notepad 靶子）

- helper：`cargo build -p anycut-windows` 通过；`list` 定位 `anycut-smoke-TEST.txt - Notepad`（HWND 0xDC19E4，PID 2640，Notepad.exe，dpi 120）。
- `anycut capture --app anycut-smoke --purpose ...` 成功：八件落盘，`screenshot.png` 3689709 字节，PNG IHDR 1028x897 与窗口 bounds 一致（真实像素，非占位）。
- `inspect` / `inspect shadow` / `audit builtin` 全过；audit 命中预期 `tree-partial`（medium，UIA 树待 R2 的诚实标记），零网络请求。
- 发现并修复：`capture.image_size_px` 硬编码 1x1（truth-in-bundle 类缺陷）。`core.mjs` 新增 `pngDimensions()` 从 PNG IHDR 解析真实尺寸；fixture（1x1 占位 PNG）仍 11/11 全绿，真机复验回报 `1028x897`。
- 已知限制（R2，不挡 v0.1）：UIA 树未实现、进程启动时间/捕获后复核待补、backend 仅 printwindow、crop 仅 window。

### 9.3 U-King 中文靶子冒烟（2026-09-07，与 §9.2 同机）

- 起 `U-King-绿色版.exe`（PID 31588）+ 常驻 `u-king-mini.exe`（PID 63624，动之前已在）。`list` 一次看到 6 个相关窗口：双主窗口、双 `*-siw` 单实例哨兵窗（14x14）、双资源管理器。
- §8.2 歧义场景免费验证：`--app U-King` 多匹配时 CLI 以 `window_ambiguous`（exit 2）拒绝，不瞎选第一个。
- `U-King AI 管家`（Tauri，2062x1246，dpi 120）：10MB 落盘，采样均值亮度 152/255、暗像素 0.1%——**非黑屏**。PrintWindow + PW_RENDERFULLCONTENT 在 WebView2 系目标上成立，§6.4 的 GPU 风险项在该靶子上关闭。
- `CC Switch`（绿色版主窗口，1485x638）：3.7MB，亮度 92.2，暗像素 0.2%——同样真实像素。
- 两包 `inspect shadow` + `builtin audit` 全过（预期 `tree-partial` 唯一 finding，零网络）。事后杀掉自起的绿色版进程，常驻 mini 服务未动。

PLAN-READY
