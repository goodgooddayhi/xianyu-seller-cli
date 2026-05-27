# xianyu-seller-cli 功能扩展计划

## 目标

完善闲鱼卖家运营闭环：消息监控 → 智能回复 → 促成下单 → 自动发货 → 售后跟进 → 评价管理 → 数据复盘

---

## Phase 1: 商品管理与数据（优先级 P0）

| 命令 | 说明 |
|------|------|
| `xianyu products` | 查看商品列表 |
| `xianyu product-edit <商品ID> --price 99` | 修改商品价格 |
| `xianyu product-on <商品ID>` | 上架商品 |
| `xianyu product-off <商品ID>` | 下架商品 |
| `xianyu dashboard` | 店铺数据概览 |
| `xianyu auto-refresh` | 定时擦亮商品 |

---

## Phase 2: 交易管理（优先级 P1）

| 命令 | 说明 |
|------|------|
| `xianyu refunds` | 查看退款列表 |
| `xianyu refund-agree <退款ID>` | 同意退款 |
| `xianyu refund-reject <退款ID> <理由>` | 拒绝退款 |
| `xianyu reviews` | 查看评价列表 |
| `xianyu review-reply <评价ID> <回复>` | 回复评价 |
| `xianyu complaints` | 查看投诉列表 |
| `xianyu complaint-handle <投诉ID> <处理方式>` | 处理投诉 |

---

## Phase 3: 高级功能（优先级 P2）

| 命令 | 说明 |
|------|------|
| `xianyu daily-report` | 生成每日数据报告 |
| `xianyu auto-review` | 自动回复评价 |
| `xianyu auto-refund` | 自动处理退款 |
| `xianyu auto-route` | 人机分流（复杂问题转人工） |
| `xianyu priority-sort` | 消息优先级排序（高价值客户优先） |

---

## Phase 4: 财务与客服（优先级 P3）

| 命令 | 说明 |
|------|------|
| `xianyu income` | 收入账单 |
| `xianyu sub-accounts` | 子账号管理 |
| `xianyu cs-routing` | 客服分流设置 |

---

## 实现顺序

| 阶段 | 内容 | 命令数 | 预估时间 |
|------|------|--------|---------|
| Phase 1 | 商品管理 + 数据概览 | 6 | 2-3 小时 |
| Phase 2 | 退款 + 评价 + 投诉 | 7 | 3-4 小时 |
| Phase 3 | 自动化 + 分流 + 优先级 | 5 | 3-4 小时 |
| Phase 4 | 财务 + 客服 | 3 | 2-3 小时 |
| **总计** | **完整闭环** | **21** | **10-14 小时** |

---

## 闭环完成后的效果

```
买家咨询 → 消息分流 → 意图分类 → 智能回复 → 促成下单 → 自动发货
    ↑                                                      ↓
    │                                               售后跟进（退款/投诉）
    │                                                      ↓
    └──────────── 数据复盘 ← 评价管理 ← 交易完成 ←─────────┘
```

**消息分流**：优先级排序 + 人机分流（简单AI回复，复杂转人工）
**发货闭环**：订单检测 → 自动发货 → 物流跟踪
**售后闭环**：退款处理 → 投诉管理 → 评价回复
**数据闭环**：每日报告 → 运营优化 → 策略调整

卖家只需：看数据面板 + 处理极少数需要人工介入的复杂问题。
