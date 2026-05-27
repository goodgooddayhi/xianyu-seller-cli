---
name: xianyu-seller-cli
description: 闲鱼卖家客服 CLI 工具 - 自动化操作闲鱼卖家版 IM、会话管理、消息收发、智能客服、订单管理
---

# xianyu-seller-cli

通过 CLI 自动化操作闲鱼卖家客服 Electron 客户端。

## 前置条件

- 闲鱼卖家客服客户端已安装
- CLI 已全局安装（`npm install -g .`）
- 客户端已通过 `xianyu launch` 启动

## 命令速查

```bash
# 会话管理
xianyu conversations          # 查看会话列表
xianyu open <编号>            # 点开会话
xianyu next / prev            # 切换会话
xianyu current                # 当前会话

# 消息操作
xianyu messages               # 获取消息
xianyu send <text>            # 发送消息
xianyu unread-all             # 所有未读数

# 信息查询
xianyu buyer-info             # 买家信息
xianyu product-info           # 商品信息
xianyu stats                  # 统计数据

# 订单管理
xianyu orders                 # 查看订单
xianyu orders -s pending      # 待发货订单
xianyu ship <订单号> <快递单号>    # 实体发货
xianyu ship-virtual <订单号>      # 虚拟发货（无需寄件）

# 自动发货配置
xianyu auto-ship-config       # 查看配置
xianyu auto-ship-add <商品ID> <SKU>  # 交互式添加规则
xianyu auto-ship-remove <商品ID>    # 删除规则

# 辅助
xianyu screenshot             # 截图
xianyu launch                 # 启动应用
```

---

## 智能客服完整流程

当用户说"自动回复闲鱼客户"、"帮我处理闲鱼消息"时，**必须按以下完整流程执行**：

```
收到消息 → 意图分类 → 专家路由 → 生成回复 → 安全过滤 → 发送
```

### 第一步：检查环境

```bash
xianyu status
xianyu login-check
```

### 第二步：获取未读消息

```bash
xianyu conversations
```

查看会话列表，找到有未读标记的会话。**不要直接打开会话**，先看预览内容判断意图。

### 第三步：意图分类

根据会话预览内容判断买家意图：

| 意图 | 匹配规则 | 示例 |
|------|---------|------|
| `price` | 含金额数字、砍价词：便宜/优惠/折扣/多少钱/降价/少点/打折 | "最低多少钱"、"能便宜点吗" |
| `tech` | 含技术词：型号/规格/参数/适配/安装/支持/兼容/内存/配置 | "支持Type-C吗"、"内存多大" |
| `no_reply` | 系统消息、评价消息、无意义内容、与交易无关 | "[去支付]"、"[去评价]"、纯表情 |
| `default` | 其他所有：物流、发货、售后、基础咨询 | "在吗"、"什么时候发货" |

**判断优先级**：`no_reply` > `tech` > `price` > `default`

### 第四步：专家路由 + 生成回复

根据分类结果，参考对应提示词生成回复：

| 意图 | 提示词文件 | 策略 |
|------|-----------|------|
| `price` | `prompts/price_prompt.txt` | 保持友好但守住底线，阶梯式让步 |
| `tech` | `prompts/tech_prompt.txt` | 简洁专业，引导查看商品详情 |
| `default` | `prompts/default_prompt.txt` | 热情友好，快速响应 |
| `no_reply` | — | **跳过，不发送任何消息** |

**回复模板速查**：

- **price**："这款已经很实惠了哦"、"可以小刀，您出个价"、"诚心要的话可以优惠一点"
- **tech**："具体参数请看商品详情页哦"、"这个型号支持的，放心拍"
- **default**："亲，在的哦"、"有什么可以帮您？"、"您好，请问需要什么？"

### 第五步：安全过滤（必须执行）

生成回复后，**必须检查是否包含以下敏感词**，如包含则替换为 "亲，请通过平台沟通哦"：

| 类别 | 禁止内容 |
|------|---------|
| 联系方式 | 微信、QQ、手机号、微信号、加我、加群、扫码 |
| 支付方式 | 支付宝、银行卡、转账、线下付款 |
| 违规商品 | 翻墙、VPN、外挂、破解、盗版、假证、作弊 |
| 敏感词 | 代写、代考、代做、刷单、炒作 |
| 站外引导 | 淘宝、京东、拼多多、抖音、其他平台、私聊加 |
| 竞品提及 | ChatGPT、GPT、OpenAI、Codex、Copilot、Gemini、Google、Grok |
| 品牌词 | Claude（对外只说"AI助手"） |

### 第六步：发送回复

确认安全过滤通过后，才发送：

```bash
xianyu open <会话编号>
xianyu send "过滤后的回复内容"
```

### 第七步：检查订单 + 自动发货

回复后检查订单状态，如果是"官方安装包"且已付款：

```bash
xianyu orders -s pending
# 确认订单后
xianyu send "感谢购买！您的安装包下载链接：https://pan.baidu.com/s/xxx 密码：xxxx"
xianyu ship-virtual <订单号>
```

---

## 回复风格要求

1. **简短直接**：每句 ≤10 字，总字数 ≤40 字
2. **平台用语**：使用闲鱼/电商常用表达（亲、拍下、发货、小刀等）
3. **不用感叹号和表情符号**
4. **结合上下文**：参考对话历史，保持回复连贯
5. **引导下单**：如果已谈拢价格，引导"确认要的话今天发货"

---

## 虚拟商品自动发货

### 配置规则

```bash
# 查看当前配置
xianyu auto-ship-config

# 交互式添加（推荐）
xianyu auto-ship-add <商品ID> <SKU名称>
# 按提示输入：是否自动发货、发货内容、或手动处理回复

# 命令行添加
xianyu auto-ship-add <商品ID> <SKU> --auto --content "链接：https://pan.baidu.com/s/xxx 密码：xxxx"
xianyu auto-ship-add <商品ID> <SKU> --reply "需要远程协助，请私聊预约"

# 删除规则
xianyu auto-ship-remove <商品ID>
```

### 发货流程

```bash
# 1. 查看待发货订单
xianyu orders -s pending

# 2. 发送密钥/链接给买家
xianyu open <会话编号>
xianyu send "感谢购买！链接：https://pan.baidu.com/s/xxx 密码：xxxx"

# 3. 在订单页面标记发货（无需寄件）
xianyu ship-virtual <订单号>
```

### 多 SKU 商品处理

配置文件 `config/auto-ship.json` 支持按 SKU 区分处理：

- **自动发货 SKU**（如官方安装包）→ 自动发网盘链接
- **手动处理 SKU**（如远程安装）→ 回复买家预约时间

---

## 注意事项

- 每次发送消息前，**必须经过安全过滤**
- `xianyu watch` 会持续运行，按 Ctrl+C 退出
- 客户端关闭后需重新 `xianyu launch`
- **Claude 对外只说"AI助手"，不要提及竞品名称**
