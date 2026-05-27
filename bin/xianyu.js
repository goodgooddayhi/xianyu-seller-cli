#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'readline';
import { launchApp } from '../lib/launcher.js';
import { listPages } from '../lib/connector.js';
import { IMClient } from '../lib/im-client.js';

// 交互式输入
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(chalk.cyan(question), answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const program = new Command();

program
  .name('xianyu')
  .description('闲鱼卖家客服 CLI 工具')
  .version('1.0.0');

// 启动应用
program
  .command('launch')
  .description('启动闲鱼卖家客服 (带远程调试端口)')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('--exe <path>', '闲鱼卖家客服路径')
  .action(async (opts) => {
    try {
      const { pid, port } = await launchApp(parseInt(opts.port), opts.exe);
      console.log(chalk.green('✓ 闲鱼卖家客服已启动'));
      console.log(chalk.gray(`  PID: ${pid}`));
      console.log(chalk.gray(`  调试端口: ${port}`));
      console.log(chalk.gray(`  等待几秒后可用 "xianyu status" 检查连接`));
    } catch (err) {
      console.error(chalk.red('启动失败:'), err.message);
      process.exit(1);
    }
  });

// 检查连接状态
program
  .command('status')
  .description('检查闲鱼卖家客服连接状态')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    try {
      const pages = await listPages(parseInt(opts.port));
      console.log(chalk.green('✓ 已连接到闲鱼卖家客服'));
      console.log(chalk.gray(`  页面数: ${pages.length}`));
      pages.forEach((p, i) => {
        console.log(chalk.gray(`  [${i}] ${p.url}`));
      });
    } catch (err) {
      console.error(chalk.red('连接失败:'), err.message);
      console.log(chalk.gray('提示: 先用 "xianyu launch" 启动应用'));
    }
  });

// 检测登录状态
program
  .command('login-check')
  .description('检测闲鱼卖家客服登录状态')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.checkLogin();
      console.log(chalk.cyan('登录状态检测:'));
      console.log(`  Cookie 检测: ${result.hasCookie ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  用户信息:    ${result.hasUserInfo ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(`  IM 界面:     ${result.hasIMInterface ? chalk.green('✓') : chalk.red('✗')}`);
      console.log(chalk.gray(`  当前 URL: ${result.url}`));
    } catch (err) {
      console.error(chalk.red('检测失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 获取未读消息
program
  .command('unread')
  .description('获取未读消息数')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getUnreadCount();
      if (result.unreadElements.length === 0) {
        console.log(chalk.gray('未检测到未读消息标记'));
      } else {
        console.log(chalk.cyan('未读消息:'));
        result.unreadElements.forEach(el => {
          console.log(`  ${chalk.yellow(el.text)} (${el.selector})`);
        });
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 获取会话列表
program
  .command('conversations')
  .description('获取会话列表')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getConversations();
      if (result.count === 0) {
        console.log(chalk.gray('未检测到会话列表'));
        console.log(chalk.gray('提示: 页面 DOM 结构可能需要更新选择器'));
      } else {
        console.log(chalk.cyan(`会话列表 (${result.count} 个):`));
        result.conversations.slice(0, 20).forEach((c, i) => {
          const badge = c.badge ? chalk.red(` [${c.badge}]`) : '';
          const time = c.time ? chalk.gray(` ${c.time}`) : '';
          const msg = c.message ? chalk.gray(` - ${c.message.substring(0, 30)}`) : '';
          console.log(`  [${i + 1}] ${c.name || c.fullText?.substring(0, 20) || '(空)'}${msg}${time}${badge}`);
        });
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 点开会话
program
  .command('open <index>')
  .description('点开指定会话（按编号，从1开始）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (index, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.clickConversation(parseInt(index) - 1);
      if (result.success) {
        console.log(chalk.green(`✓ 已打开会话: ${result.name}`));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('打开失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 当前会话
program
  .command('current')
  .description('查看当前选中的会话')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getCurrentChat();
      if (result.active) {
        console.log(chalk.cyan(`当前会话: ${result.name || '(未识别)'}`));
      } else {
        console.log(chalk.gray('当前未选择任何会话'));
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 搜索会话
program
  .command('search <keyword>')
  .description('搜索会话')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (keyword, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.searchConversation(keyword);
      if (result.success) {
        console.log(chalk.green(`✓ 已搜索: ${keyword}`));
        console.log(chalk.gray('请查看应用界面中的搜索结果'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('搜索失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 清除搜索
program
  .command('clear-search')
  .description('清除搜索')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.clearSearch();
      if (result.success) {
        console.log(chalk.green('✓ 已清除搜索'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('清除失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 获取当前聊天消息
program
  .command('messages')
  .description('获取当前聊天窗口的消息')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('-n, --count <count>', '显示条数', '30')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getMessages();
      if (result.count === 0) {
        console.log(chalk.gray('未检测到消息'));
      } else {
        console.log(chalk.cyan(`消息 (${result.count} 条):`));
        const limit = parseInt(opts.count) || 30;
        result.messages.slice(0, limit).forEach((m, i) => {
          if (m.type === 'system') {
            console.log(chalk.gray(`  [${i + 1}] ${m.text}`));
          } else {
            const sender = m.type === 'sent' ? chalk.blue('我') : chalk.green(m.name || '对方');
            const read = m.isRead ? chalk.gray(' 已读') : '';
            const time = m.time ? chalk.gray(` ${m.time}`) : '';
            console.log(`  [${i + 1}] ${sender}: ${m.text?.substring(0, 80) || '(空)'}${read}${time}`);
          }
        });
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 发送消息
program
  .command('send <text>')
  .description('在当前聊天窗口发送消息')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (text, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      console.log(chalk.gray(`发送: ${text}`));
      const result = await client.sendMessage(text);
      if (result.success) {
        console.log(chalk.green(`✓ 消息已发送 (${result.method})`));
      } else {
        console.log(chalk.red(`✗ 发送失败: ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('发送失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 截图
program
  .command('screenshot')
  .description('截取当前页面截图')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('-o, --output <path>', '保存路径', 'xianyu-screenshot.png')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const saved = await client.screenshot(opts.output);
      console.log(chalk.green(`✓ 截图已保存: ${saved}`));
    } catch (err) {
      console.error(chalk.red('截图失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 买家信息
program
  .command('buyer-info')
  .description('获取当前会话的买家信息')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getBuyerInfo();
      if (result.error) {
        console.log(chalk.red(`✗ ${result.error}`));
      } else {
        console.log(chalk.cyan('买家信息:'));
        console.log(`  昵称: ${result.name || '(无)'}`);
        console.log(`  闲鱼号: ${result.xianyuId || '(无)'}`);
        if (result.avatar) console.log(`  头像: ${result.avatar.substring(0, 60)}...`);
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 商品信息
program
  .command('product-info')
  .description('获取当前会话的商品信息')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getProductInfo();
      if (result.error) {
        console.log(chalk.red(`✗ ${result.error}`));
      } else {
        console.log(chalk.cyan('商品信息:'));
        if (result.price) console.log(`  价格: ${chalk.red(result.price)}`);
        if (result.status) console.log(`  状态: ${result.status}`);
        if (result.buttonText) console.log(`  操作: ${result.buttonText}`);
        if (result.image) console.log(`  图片: ${result.image.substring(0, 60)}...`);
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 统计信息
program
  .command('stats')
  .description('获取统计数据（响应率、接待人数）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getStats();
      console.log(chalk.cyan('统计数据:'));
      if (result.responseRate) console.log(`  响应率: ${chalk.yellow(result.responseRate)}`);
      if (result.visitorCount) console.log(`  接待人数: ${chalk.yellow(result.visitorCount)}`);
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 所有未读
program
  .command('unread-all')
  .description('获取所有会话的未读消息数')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.getAllUnread();
      console.log(chalk.cyan(`未读消息 (共 ${chalk.red(result.totalUnread)} 条):`));
      result.conversations.filter(c => c.unread > 0).forEach(c => {
        console.log(`  [${c.index + 1}] ${c.name}: ${chalk.red(c.unread)}`);
      });
      if (result.conversations.filter(c => c.unread > 0).length === 0) {
        console.log(chalk.gray('  暂无未读消息'));
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 下一个会话
program
  .command('next')
  .description('切换到下一个会话')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.nextConversation();
      if (result.success) {
        console.log(chalk.green(`✓ 已切换到: ${result.name}`));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('切换失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 上一个会话
program
  .command('prev')
  .description('切换到上一个会话')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.prevConversation();
      if (result.success) {
        console.log(chalk.green(`✓ 已切换到: ${result.name}`));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('切换失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 滚动到更早的消息
program
  .command('scroll-up')
  .description('滚动到更早的消息')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.scrollUp();
      if (result.success) {
        console.log(chalk.green('✓ 已滚动到顶部'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('滚动失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 打开表情
program
  .command('emoji')
  .description('打开表情面板')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.openEmoji();
      if (result.success) {
        console.log(chalk.green('✓ 已打开表情面板'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('打开失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 快捷回复
program
  .command('quick-reply')
  .description('打开快捷回复面板')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.sendQuickReply();
      if (result.success) {
        console.log(chalk.green('✓ 已打开快捷回复面板'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('打开失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 关闭当前标签
program
  .command('close-tab')
  .description('关闭当前标签页')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = await client.closeCurrentTab();
      if (result.success) {
        console.log(chalk.green('✓ 已关闭标签页'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('关闭失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 监听新消息
program
  .command('watch')
  .description('监听新消息（每5秒检查一次）')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('-i, --interval <seconds>', '检查间隔（秒）', '5')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      console.log(chalk.cyan('开始监听新消息... (Ctrl+C 退出)'));
      let lastCount = 0;

      const check = async () => {
        try {
          const result = await client.getUnreadCount();
          const currentCount = result.unreadElements.length;
          if (currentCount > lastCount && lastCount > 0) {
            console.log(chalk.yellow(`\n[新消息] 检测到新的未读消息!`));
            // 获取会话列表更新
            const convs = await client.getConversations();
            convs.conversations.slice(0, 5).forEach(c => {
              if (c.badge) {
                console.log(chalk.yellow(`  ${c.name}: ${c.message}`));
              }
            });
          }
          lastCount = currentCount;
        } catch (e) {
          console.error(chalk.red('[监听错误]'), e.message);
        }
      };

      // 立即检查一次
      await check();

      // 定期检查
      const interval = setInterval(check, parseInt(opts.interval) * 1000);

      // 优雅退出
      process.on('SIGINT', () => {
        clearInterval(interval);
        client.disconnect();
        console.log(chalk.gray('\n监听已停止'));
        process.exit(0);
      });

      // 保持进程运行
      await new Promise(() => {});
    } catch (err) {
      console.error(chalk.red('监听失败:'), err.message);
      client.disconnect();
    }
  });

// 调试: DOM 概览
program
  .command('debug-dom')
  .description('获取页面 DOM 结构概览 (调试用)')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('-d, --depth <depth>', '遍历深度', '3')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const overview = await client.getDOMOverview();
      console.log(chalk.cyan('DOM 结构:'));
      console.log(JSON.stringify(overview, null, 2));
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// ===== 自动发货配置 =====

// 查看自动发货配置
program
  .command('auto-ship-config')
  .description('查看自动发货配置')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const config = client.getAutoShipConfig();
      console.log(chalk.cyan('自动发货配置:'));
      console.log(chalk.gray(`  默认自动发货: ${config.global?.defaultAutoShip ? '是' : '否'}`));
      console.log('');
      for (const [pid, product] of Object.entries(config.products || {})) {
        console.log(chalk.yellow(`  商品: ${product.name} (${pid})`));
        for (const [sku, rule] of Object.entries(product.skus || {})) {
          const status = rule.autoShip ? chalk.green('自动发货') : chalk.red('手动处理');
          console.log(`    ${sku}: ${status}`);
          if (rule.autoShip && rule.content) {
            console.log(chalk.gray(`      链接/密钥: ${rule.content.substring(0, 50)}...`));
          }
          if (!rule.autoShip && rule.reply) {
            console.log(chalk.gray(`      回复: ${rule.reply.substring(0, 50)}...`));
          }
        }
        console.log('');
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 添加商品自动发货规则
program
  .command('auto-ship-add <productId> <skuName>')
  .description('添加商品自动发货规则（交互式或命令行参数）')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('--auto', '启用自动发货')
  .option('--content <text>', '发货内容（密钥/链接）')
  .option('--reply <text>', '手动处理时的回复')
  .action(async (productId, skuName, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();

      // 交互式模式：没传参数时询问
      let autoShip = opts.auto;
      let content = opts.content || '';
      let reply = opts.reply || '';

      if (autoShip === undefined) {
        console.log(chalk.cyan(`配置商品 ${productId} 的 SKU: ${skuName}`));
        const type = await ask('自动发货？(y/n): ');
        autoShip = type.toLowerCase() === 'y';
      }

      if (autoShip && !content) {
        content = await ask('发货内容（网盘链接/密钥/激活码）: ');
      }

      if (!autoShip && !reply) {
        reply = await ask('手动处理回复（如：需要远程协助，请私聊预约）: ');
      }

      const rule = {
        autoShip,
        type: autoShip ? 'virtual' : 'remote',
        content,
        reply,
      };

      const result = client.updateSkuConfig(productId, skuName, rule);
      if (result.success) {
        console.log(chalk.green(`✓ 已添加规则: ${skuName}`));
        console.log(chalk.gray(`  自动发货: ${rule.autoShip ? '是' : '否'}`));
        if (rule.content) console.log(chalk.gray(`  内容: ${rule.content.substring(0, 60)}...`));
        if (rule.reply) console.log(chalk.gray(`  回复: ${rule.reply.substring(0, 60)}...`));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('添加失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 删除商品自动发货规则
program
  .command('auto-ship-remove <productId>')
  .description('删除商品自动发货规则')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (productId, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      const result = client.removeProductConfig(productId);
      if (result.success) {
        console.log(chalk.green(`✓ 已删除商品 ${productId} 的配置`));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('删除失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// ===== 订单管理 =====

// 查看订单
program
  .command('orders')
  .description('查看订单列表')
  .option('-p, --port <port>', '调试端口', '9222')
  .option('-s, --status <status>', '订单状态: all/pending/shipped/success', 'all')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      // 导航到订单管理页面
      await client.goToOrders();
      await new Promise(r => setTimeout(r, 2000));
      // 切换到对应 tab
      await client.getOrders(opts.status);
      await new Promise(r => setTimeout(r, 1000));
      // 解析订单
      const result = await client.parseOrders();
      if (result.count === 0) {
        console.log(chalk.gray('未找到订单'));
      } else {
        console.log(chalk.cyan(`订单列表 (${result.count} 个):`));
        result.orders.forEach((o, i) => {
          const status = o.status === '交易成功' ? chalk.green(o.status)
            : o.status === '待发货' ? chalk.yellow(o.status)
            : o.status === '交易关闭' ? chalk.gray(o.status)
            : o.status;
          console.log(`  [${i + 1}] ${chalk.dim(o.orderId)} ${o.product || ''} ${chalk.red('¥' + o.price)} ${status}`);
        });
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 发货（实体商品）
program
  .command('ship <orderId> <trackingNumber>')
  .description('发货（实体商品，填写快递单号）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (orderId, trackingNumber, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      console.log(chalk.gray(`订单: ${orderId}`));
      console.log(chalk.gray(`快递单号: ${trackingNumber}`));
      const result = await client.shipOrder(orderId, trackingNumber);
      if (result.success) {
        console.log(chalk.green(`✓ 已点击发货按钮`));
        console.log(chalk.gray('  请在弹窗中确认发货信息'));
      } else {
        console.log(chalk.red(`✗ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red('发货失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 发货（虚拟商品）
program
  .command('ship-virtual <orderId>')
  .description('发货（虚拟商品，无需寄件）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (orderId, opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      console.log(chalk.gray(`订单: ${orderId}`));
      console.log(chalk.gray('选择无需寄件...'));
      const result = await client.shipVirtualOrder(orderId);
      if (result.success) {
        console.log(chalk.green('✓ 虚拟商品发货成功'));
      } else {
        console.log(chalk.red(`✗ ${result.error || '发货失败'}`));
      }
    } catch (err) {
      console.error(chalk.red('发货失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 自动发货（实体商品 - Agent 驱动）
program
  .command('auto-ship')
  .description('自动发货实体商品（Agent 驱动，需配合 SKILL.md）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      await client.goToOrders();
      await new Promise(r => setTimeout(r, 2000));
      await client.getOrders('pending');
      await new Promise(r => setTimeout(r, 1000));
      const result = await client.parseOrders();
      if (result.count === 0) {
        console.log(chalk.green('✓ 没有待发货订单'));
      } else {
        console.log(chalk.cyan(`待发货订单 (${result.count} 个):`));
        result.orders.forEach((o, i) => {
          console.log(`  [${i + 1}] ${chalk.dim(o.orderId)} ${o.product || ''} ${chalk.red('¥' + o.price)} ${o.buyer || ''}`);
        });
        console.log(chalk.gray('\n提示: 使用 "xianyu ship <订单号> <快递单号>" 手动发货'));
        console.log(chalk.gray('或让 Agent 读取 SKILL.md 自动处理'));
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

// 自动发货（虚拟商品 - Agent 驱动）
program
  .command('auto-ship-virtual')
  .description('自动发货虚拟商品（Agent 驱动，需配合 SKILL.md）')
  .option('-p, --port <port>', '调试端口', '9222')
  .action(async (opts) => {
    const client = new IMClient(parseInt(opts.port));
    try {
      await client.connect();
      await client.goToOrders();
      await new Promise(r => setTimeout(r, 2000));
      await client.getOrders('pending');
      await new Promise(r => setTimeout(r, 1000));
      const result = await client.parseOrders();
      if (result.count === 0) {
        console.log(chalk.green('✓ 没有待发货订单'));
      } else {
        console.log(chalk.cyan(`待发货订单 (${result.count} 个):`));
        result.orders.forEach((o, i) => {
          console.log(`  [${i + 1}] ${chalk.dim(o.orderId)} ${o.product || ''} ${chalk.red('¥' + o.price)} ${o.buyer || ''}`);
        });
        console.log(chalk.gray('\n提示: 使用 "xianyu ship-virtual <订单号> <密钥/链接>" 发货'));
        console.log(chalk.gray('或让 Agent 读取 SKILL.md 自动处理'));
      }
    } catch (err) {
      console.error(chalk.red('获取失败:'), err.message);
    } finally {
      client.disconnect();
    }
  });

program.parse();
