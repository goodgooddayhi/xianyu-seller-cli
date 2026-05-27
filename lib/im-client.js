import { connect } from './connector.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'auto-ship.json');

// 加载自动发货配置
function loadAutoShipConfig() {
  if (!existsSync(CONFIG_PATH)) return { products: {}, global: {} };
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

// 保存自动发货配置
function saveAutoShipConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export class IMClient {
  constructor(port = 9222) {
    this.port = port;
    this.browser = null;
    this.page = null;
  }

  async connect() {
    const { browser, page } = await connect(this.port);
    this.browser = browser;
    this.page = page;
    return this;
  }

  disconnect() {
    if (this.browser) {
      this.browser.disconnect();
      this.browser = null;
      this.page = null;
    }
  }

  // 执行页面 JS 并返回结果
  async evaluate(fn, ...args) {
    return this.page.evaluate(fn, ...args);
  }

  // 检测登录状态
  async checkLogin() {
    const result = await this.evaluate(() => {
      // 检查页面上是否有登录态标识
      const cookies = document.cookie;
      const hasCookie = cookies.includes('_tb_token_') ||
                        cookies.includes('sgcookie') ||
                        cookies.includes('unb=') ||
                        cookies.includes('cookie2=');
      // 检查是否有用户头像或昵称元素
      const hasUserInfo = !!document.querySelector('[class*="avatar"]') ||
                          !!document.querySelector('[class*="nick"]') ||
                          !!document.querySelector('[class*="user-name"]') ||
                          !!document.querySelector('[class*="userName"]');
      // 检查是否有 IM 界面
      const hasIMInterface = !!document.querySelector('[class*="session-list"]') ||
                             !!document.querySelector('[class*="chat-list"]') ||
                             !!document.querySelector('[class*="conversation"]') ||
                             !!document.querySelector('[class*="im-"]');
      return {
        hasCookie,
        hasUserInfo,
        hasIMInterface,
        url: window.location.href,
        title: document.title,
        cookieSample: cookies.substring(0, 200),
      };
    });
    return result;
  }

  // 获取未读消息数
  async getUnreadCount() {
    const result = await this.evaluate(() => {
      // 尝试多种可能的选择器
      const selectors = [
        '[class*="unread"]',
        '[class*="badge"]',
        '[class*="unread-count"]',
        '[class*="msg-count"]',
        '[class*="red-dot"]',
      ];
      const unreadElements = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const text = el.textContent?.trim();
          if (text && /\d+/.test(text)) {
            unreadElements.push({
              selector: sel,
              text,
              className: el.className,
            });
          }
        });
      }
      return { unreadElements };
    });
    return result;
  }

  // 获取所有会话的未读数
  async getAllUnread() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('[class*="conversation-item"]');
      const conversations = Array.from(items).map((el, index) => {
        const nameEl = el.querySelector('[class*="name"], [class*="nick"]');
        const badgeEl = el.querySelector('.ant-badge');
        const badgeCount = badgeEl?.textContent?.trim() || '';
        return {
          index,
          name: nameEl?.textContent?.trim() || el.textContent?.trim().substring(0, 30),
          unread: badgeCount ? parseInt(badgeCount) || 0 : 0,
        };
      });
      const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
      return { conversations, totalUnread };
    });
    return result;
  }

  // 获取会话列表
  async getConversations() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('[class*="conversation-item"]');
      const conversations = Array.from(items).map((el, index) => {
        // 提取会话信息
        const nameEl = el.querySelector('[class*="name"], [class*="nick"], [class*="title"]');
        const msgEl = el.querySelector('[class*="message"], [class*="msg"], [class*="content"], [class*="desc"]');
        const timeEl = el.querySelector('[class*="time"], [class*="date"]');
        const badgeEl = el.querySelector('[class*="badge"]');
        const avatarEl = el.querySelector('img[class*="avatar"], [class*="avatar"] img');

        return {
          index,
          name: nameEl?.textContent?.trim() || '',
          message: msgEl?.textContent?.trim() || '',
          time: timeEl?.textContent?.trim() || '',
          badge: badgeEl?.textContent?.trim() || '',
          avatar: avatarEl?.getAttribute('src') || '',
          fullText: el.textContent?.trim().substring(0, 150) || '',
        };
      });
      return { conversations, count: conversations.length };
    });
    return result;
  }

  // 获取当前聊天消息
  async getMessages() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('li.ant-list-item');
      const messages = Array.from(items).map((el, index) => {
        const style = el.getAttribute('style') || '';
        const direction = el.closest('[style*="direction: rtl"]') ? 'rtl' : 'ltr';
        const isSent = direction === 'rtl'; // rtl = 右对齐 = 我发的
        const isSystem = el.querySelector('[class*="tips"], [class*="msg-tips"], [class*="msg-text-card"]');

        // 提取消息文本
        const textEl = el.querySelector('[class*="bubble"], [class*="content"], [class*="text"]');
        const fullText = el.textContent?.trim() || '';

        // 提取时间（来自父级的 div）
        const parent = el.parentElement;
        const timeDiv = parent?.previousElementSibling?.textContent?.trim() || '';

        // 提取发送者
        const nameEl = el.querySelector('[class*="name"], [class*="nick"]');

        // 提取已读状态
        const readEl = el.querySelector('[class*="read"]');

        // 提取图片
        const imgEls = el.querySelectorAll('img:not([class*="avatar"])');

        // 系统消息（如"你已发货"、"交易成功"）
        if (isSystem) {
          return {
            index,
            type: 'system',
            text: fullText.substring(0, 100),
            time: timeDiv,
          };
        }

        // 去掉文本中的"已读"，单独处理
        let cleanText = (textEl?.textContent?.trim() || fullText.substring(0, 200)).replace(/已读$/, '').trim();

        return {
          index,
          type: isSent ? 'sent' : 'received',
          text: cleanText,
          time: timeDiv,
          name: nameEl?.textContent?.trim() || '',
          hasImage: imgEls.length > 0,
          isRead: !!readEl || fullText.includes('已读'),
          className: el.className?.substring(0, 60),
        };
      });

      return { messages, count: messages.length };
    });
    return result;
  }

  // 发送消息（在当前聊天窗口）
  async sendMessage(text) {
    const result = await this.evaluate((msg) => {
      // 找输入框 - 使用真实选择器
      const inputEl = document.querySelector('textarea.ant-input[class*="textarea"]');
      if (!inputEl) {
        return { success: false, error: '找不到输入框' };
      }

      // 设置文本
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputEl, msg);
      } else {
        inputEl.value = msg;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));

      // 找发送按钮
      const sendBtn = document.querySelector('.sendbox--A9eGQCY5 button[class*="ant-btn"]');
      if (sendBtn) {
        sendBtn.click();
        return { success: true, method: 'button-click' };
      }

      // 回车发送
      inputEl.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true,
      }));

      return { success: true, method: 'enter-key' };
    }, text);
    return result;
  }

  // 截取页面快照
  async screenshot(savePath) {
    await this.page.screenshot({ path: savePath, fullPage: false });
    return savePath;
  }

  // 点击指定会话（按索引）
  async clickConversation(index) {
    const result = await this.evaluate((idx) => {
      const items = document.querySelectorAll('[class*="conversation-item"]');
      if (idx >= 0 && idx < items.length) {
        items[idx].click();
        return { success: true, name: items[idx].textContent?.trim().substring(0, 50) };
      }
      return { success: false, error: `会话索引 ${idx} 不存在，共 ${items.length} 个会话` };
    }, index);
    return result;
  }

  // 搜索会话
  async searchConversation(keyword) {
    const result = await this.evaluate((kw) => {
      const searchInput = document.querySelector('.ant-input');
      if (!searchInput) return { success: false, error: '找不到搜索框' };

      // 设置搜索值
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(searchInput, kw);
      } else {
        searchInput.value = kw;
      }
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    }, keyword);
    return result;
  }

  // 清除搜索
  async clearSearch() {
    const result = await this.evaluate(() => {
      const searchInput = document.querySelector('.ant-input');
      if (!searchInput) return { success: false, error: '找不到搜索框' };

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(searchInput, '');
      } else {
        searchInput.value = '';
      }
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    });
    return result;
  }

  // 获取当前选中的会话名称
  async getCurrentChat() {
    const result = await this.evaluate(() => {
      const emptyState = document.querySelector('[class*="empty"], [class*="placeholder"]');
      if (emptyState && emptyState.textContent?.includes('尚未选择')) {
        return { active: false, name: '' };
      }

      const topbar = document.querySelector('[class*="message-topbar"]');
      const nameEl = topbar?.querySelector('[class*="text1"]');
      const idEl = topbar?.querySelector('[class*="text2"]');

      return {
        active: true,
        name: nameEl?.textContent?.trim() || '',
        xianyuId: idEl?.textContent?.trim() || '',
      };
    });
    return result;
  }

  // 获取买家信息
  async getBuyerInfo() {
    const result = await this.evaluate(() => {
      const topbar = document.querySelector('[class*="message-topbar"]');
      if (!topbar) return { error: '未打开会话' };

      const nameEl = topbar.querySelector('[class*="text1"]');
      const idEl = topbar.querySelector('[class*="text2"]');

      // 获取头像
      const avatarEl = document.querySelector('[class*="chat-main"] img[class*="avatar"]');

      return {
        name: nameEl?.textContent?.trim() || '',
        xianyuId: idEl?.textContent?.trim() || '',
        avatar: avatarEl?.getAttribute('src') || '',
      };
    });
    return result;
  }

  // 获取商品信息
  async getProductInfo() {
    const result = await this.evaluate(() => {
      const productArea = document.querySelector('[class*="container--"]');
      if (!productArea) return { error: '未找到商品信息' };

      const priceEl = productArea.querySelector('[class*="price"]');
      const imgEl = productArea.querySelector('img');
      const btnEl = productArea.querySelector('[class*="messageHeadBtnContainer"]');

      // 获取状态文字（如"您已评价,等待对方评价"）
      const statusText = productArea.querySelector('[class*="text2"], [class*="status"]');

      return {
        price: priceEl?.textContent?.trim() || '',
        image: imgEl?.getAttribute('src') || '',
        status: statusText?.textContent?.trim() || '',
        buttonText: btnEl?.textContent?.trim() || '',
      };
    });
    return result;
  }

  // 获取统计数据
  async getStats() {
    const result = await this.evaluate(() => {
      // 获取响应率和接待人数
      const statsArea = document.querySelector('[class*="stats"], [class*="overview"]');
      const allText = document.body.textContent || '';

      // 从页面提取数据
      const responseRateMatch = allText.match(/(\d+\.?\d*%)/);
      const visitorCountMatch = allText.match(/(\d+)\s*人/);

      return {
        responseRate: responseRateMatch?.[1] || '',
        visitorCount: visitorCountMatch?.[1] || '',
      };
    });
    return result;
  }

  // 切换到下一个会话
  async nextConversation() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('[class*="conversation-item"]');
      // 找到当前激活的会话
      let activeIndex = -1;
      items.forEach((item, i) => {
        if (item.classList.toString().includes('active') || item.classList.toString().includes('selected')) {
          activeIndex = i;
        }
      });
      // 点击下一个
      const nextIdx = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
      if (nextIdx < items.length) {
        items[nextIdx].click();
        return { success: true, index: nextIdx, name: items[nextIdx].textContent?.trim().substring(0, 30) };
      }
      return { success: false, error: '没有更多会话' };
    });
    return result;
  }

  // 切换到上一个会话
  async prevConversation() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('[class*="conversation-item"]');
      let activeIndex = -1;
      items.forEach((item, i) => {
        if (item.classList.toString().includes('active') || item.classList.toString().includes('selected')) {
          activeIndex = i;
        }
      });
      const prevIdx = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
      if (prevIdx >= 0 && prevIdx < items.length) {
        items[prevIdx].click();
        return { success: true, index: prevIdx, name: items[prevIdx].textContent?.trim().substring(0, 30) };
      }
      return { success: false, error: '没有更多会话' };
    });
    return result;
  }

  // 滚动到更早的消息
  async scrollUp() {
    const result = await this.evaluate(() => {
      const scrollContainer = document.querySelector('[class*="scroll-container"]');
      if (!scrollContainer) return { success: false, error: '找不到消息容器' };
      scrollContainer.scrollTop = 0;
      return { success: true };
    });
    return result;
  }

  // 打开表情面板
  async openEmoji() {
    const result = await this.evaluate(() => {
      const emojiBtn = document.querySelector('[class*="emoji-icon"]');
      if (!emojiBtn) return { success: false, error: '找不到表情按钮' };
      emojiBtn.click();
      return { success: true };
    });
    return result;
  }

  // 发送快捷回复
  async sendQuickReply() {
    const result = await this.evaluate(() => {
      const quickReplyBtn = document.querySelector('[class*="quick-reply"]');
      if (!quickReplyBtn) return { success: false, error: '找不到快捷回复按钮' };
      quickReplyBtn.click();
      return { success: true };
    });
    return result;
  }

  // 上传文件/图片
  async uploadFile(filePath) {
    const result = await this.evaluate((path) => {
      const uploadInput = document.querySelector('input[type="file"], .ant-upload input');
      if (!uploadInput) return { success: false, error: '找不到文件上传入口' };
      // 注意：由于安全限制，无法通过 JS 直接设置文件路径
      // 需要通过 Electron IPC 或 CDP 的 DOM.setFileInputFiles 来实现
      return { success: false, error: '需要通过 CDP 上传文件' };
    }, filePath);
    return result;
  }

  // 关闭当前标签页
  async closeCurrentTab() {
    const result = await this.evaluate(() => {
      // 通过 Electron IPC 关闭当前标签
      if (window.$gnb?.$desktop) {
        window.$gnb.$desktop({ type: 'closeTabOnTabPage', data: { id: -1 } });
        return { success: true };
      }
      return { success: false, error: '找不到 Electron IPC' };
    });
    return result;
  }

  // 获取指定会话的最后一条消息
  async getLastMessage() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('li.ant-list-item');
      if (items.length === 0) return { text: '', type: 'none' };

      const lastItem = items[items.length - 1];
      const style = lastItem.getAttribute('style') || '';
      const parentStyle = lastItem.parentElement?.getAttribute('style') || '';
      const isSent = parentStyle.includes('direction: rtl') || style.includes('direction: rtl');

      return {
        text: lastItem.textContent?.trim().substring(0, 200) || '',
        type: isSent ? 'sent' : 'received',
      };
    });
    return result;
  }

  // ===== 自动发货配置 =====

  // 获取自动发货配置
  getAutoShipConfig() {
    return loadAutoShipConfig();
  }

  // 检查商品是否需要自动发货
  checkAutoShip(productName, skuName) {
    const config = loadAutoShipConfig();
    for (const [pid, product] of Object.entries(config.products || {})) {
      if (productName.includes(product.name) || product.name.includes(productName)) {
        // 检查 SKU
        for (const [sku, rule] of Object.entries(product.skus || {})) {
          if (skuName.includes(sku) || sku === 'default') {
            return { autoShip: rule.autoShip, ...rule };
          }
        }
      }
    }
    return { autoShip: config.global?.defaultAutoShip || false };
  }

  // 添加商品配置
  addProductConfig(productId, name, skus) {
    const config = loadAutoShipConfig();
    config.products[productId] = { name, skus };
    saveAutoShipConfig(config);
    return { success: true };
  }

  // 更新 SKU 配置
  updateSkuConfig(productId, skuName, rule) {
    const config = loadAutoShipConfig();
    if (config.products[productId]) {
      config.products[productId].skus[skuName] = rule;
      saveAutoShipConfig(config);
      return { success: true };
    }
    return { success: false, error: '商品不存在' };
  }

  // 删除商品配置
  removeProductConfig(productId) {
    const config = loadAutoShipConfig();
    delete config.products[productId];
    saveAutoShipConfig(config);
    return { success: true };
  }

  // ===== 订单管理 =====

  // 导航到订单管理页面
  async goToOrders() {
    const result = await this.evaluate(() => {
      const items = document.querySelectorAll('[class*="subMenuItem"]');
      for (const item of items) {
        if (item.textContent?.trim() === '订单管理') {
          item.click();
          return { success: true };
        }
      }
      return { success: false, error: '找不到订单管理菜单' };
    });
    return result;
  }

  // 获取订单列表
  async getOrders(status = 'all') {
    const result = await this.evaluate((st) => {
      // 点击对应的 tab
      const tabs = document.querySelectorAll('[class*="tab--"]');
      for (const tab of tabs) {
        const title = tab.querySelector('[class*="tabTitle"]');
        if (title) {
          const tabText = title.textContent?.trim();
          if (st === 'pending' && tabText === '待发货') tab.click();
          else if (st === 'shipped' && tabText === '已发货') tab.click();
          else if (st === 'success' && tabText === '交易成功') tab.click();
          else if (st === 'all' && tabText === '全部') tab.click();
        }
      }
      return { clicked: st };
    }, status);
    return result;
  }

  // 解析当前页面的订单
  async parseOrders() {
    const result = await this.evaluate(() => {
      const orders = [];
      // 找订单编号
      const orderTexts = document.body.textContent || '';
      const orderRegex = /订单编号(\d{18,})/g;
      let match;
      while ((match = orderRegex.exec(orderTexts)) !== null) {
        orders.push({ orderId: match[1] });
      }

      // 找每个订单的详细信息
      const orderBlocks = document.querySelectorAll('[class*="orderItem"], [class*="order-item"]');
      orderBlocks.forEach((block, i) => {
        const text = block.textContent || '';
        const orderIdMatch = text.match(/订单编号(\d{18,})/);
        const priceMatch = text.match(/¥([\d.]+)/);
        const timeMatch = text.match(/下单时间\s*(\d{4}-\d{2}-\d{2}\s*\d{2}:\d{2}:\d{2})/);
        const statusMatch = text.match(/(交易成功|交易关闭|待发货|已发货|待付款|退款成功)/);
        const buyerMatch = text.match(/包邮([\w一-鿿]+)联系/);
        const productMatch = text.match(/\d+\s+([\s\S]{2,30}?)交易/);

        orders.push({
          orderId: orderIdMatch?.[1] || '',
          price: priceMatch?.[1] || '',
          time: timeMatch?.[1] || '',
          status: statusMatch?.[1] || '',
          buyer: buyerMatch?.[1] || '',
          product: productMatch?.[1]?.trim() || '',
        });
      });

      // 去重
      const seen = new Set();
      const unique = orders.filter(o => {
        if (!o.orderId || seen.has(o.orderId)) return false;
        seen.add(o.orderId);
        return true;
      });

      return { orders: unique, count: unique.length };
    });
    return result;
  }

  // 发货（实体商品）
  async shipOrder(orderId, trackingNumber) {
    const result = await this.evaluate((oid, tn) => {
      // 找到对应订单的发货按钮
      const buttons = document.querySelectorAll('button, [class*="btn"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text === '发货') {
          btn.click();
          return { success: true, action: 'clicked-ship-button' };
        }
      }
      return { success: false, error: '找不到发货按钮' };
    }, orderId, trackingNumber);
    return result;
  }

  // 发货（虚拟商品 - 无需寄件）
  async shipVirtualOrder(orderId) {
    // 1. 点击去发货按钮
    const clickResult = await this.evaluate(() => {
      const links = document.querySelectorAll('a, button, [class*="btn"]');
      for (const link of links) {
        const text = link.textContent?.trim() || '';
        if (text === '去发货') {
          link.click();
          return { success: true };
        }
      }
      return { success: false, error: '找不到去发货按钮' };
    });

    if (!clickResult.success) return clickResult;

    // 等待弹窗
    await new Promise(r => setTimeout(r, 2000));

    // 2. 点击无需寄件
    const noShipResult = await this.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        if (text === '无需寄件') {
          el.click();
          return { success: true };
        }
      }
      return { success: false, error: '找不到无需寄件选项' };
    });

    if (!noShipResult.success) return noShipResult;

    await new Promise(r => setTimeout(r, 500));

    // 3. 点击确认发货
    const confirmResult = await this.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text === '确认发货') {
          btn.click();
          return { success: true };
        }
      }
      return { success: false, error: '找不到确认发货按钮' };
    });

    await new Promise(r => setTimeout(r, 2000));

    // 4. 检查是否成功
    const checkResult = await this.evaluate(() => {
      const text = document.body?.textContent || '';
      if (text.includes('发货成功')) return { success: true };
      return { success: false };
    });

    return checkResult.success ? { success: true } : confirmResult;
  }

  // 获取页面 DOM 结构概览（调试用）
  async getDOMOverview() {
    const result = await this.evaluate(() => {
      // 找到左侧面板（会话列表）
      const leftPanel = document.querySelector('[class*="leftPanel"]');
      // 找到主内容区域
      const mainContent = document.querySelector('[class*="rightPanel"], [class*="chatPanel"], [class*="mainContent"]');

      function getTree(el, depth = 0, maxDepth = 4) {
        if (depth > maxDepth || !el) return null;
        const children = [];
        for (const child of el.children) {
          const info = {
            tag: child.tagName.toLowerCase(),
            class: child.className?.toString().substring(0, 80) || '',
            id: child.id || '',
            childCount: child.children.length,
            text: child.children.length === 0 ? child.textContent?.trim().substring(0, 50) || '' : '',
          };
          if (depth < maxDepth && child.children.length > 0) {
            info.children = getTree(child, depth + 1, maxDepth);
          }
          children.push(info);
          if (children.length >= 15) break;
        }
        return children;
      }

      return {
        leftPanel: leftPanel ? getTree(leftPanel, 0, 6) : 'not found',
        mainContent: mainContent ? getTree(mainContent, 0, 4) : 'not found',
        // 列出所有包含 "session", "message", "chat", "conversation" 的元素
        relevantElements: Array.from(document.querySelectorAll('*')).filter(el =>
          el.className?.toString().match(/session|message|chat|conversation|input|editor|send|unread|badge/i)
        ).slice(0, 20).map(el => ({
          tag: el.tagName.toLowerCase(),
          class: el.className?.toString().substring(0, 80) || '',
          id: el.id || '',
          childCount: el.children.length,
        })),
      };
    });
    return result;
  }
}
