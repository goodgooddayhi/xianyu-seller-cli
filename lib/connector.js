import puppeteer from 'puppeteer-core';

const DEFAULT_PORT = 9222;

export async function connect(port = DEFAULT_PORT) {
  const browserURL = `http://127.0.0.1:${port}`;

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL });
  } catch (err) {
    throw new Error(
      `无法连接到闲鱼卖家客服 (端口 ${port})。\n` +
      `请先用 "xianyu launch" 启动应用，或确认应用已带 --remote-debugging-port=${port} 参数运行。\n` +
      `原始错误: ${err.message}`
    );
  }

  const pages = await browser.pages();
  // 找到加载 seller.goofish.com 的页面
  const targetPage = pages.find(p => p.url().includes('seller.goofish.com'));

  if (!targetPage) {
    // 列出所有页面帮助调试
    const urls = pages.map(p => p.url());
    await browser.disconnect();
    throw new Error(
      `未找到闲鱼卖家客服页面。\n当前页面: ${urls.join(', ') || '无'}\n` +
      `请确认应用已登录并打开了客服页面。`
    );
  }

  return { browser, page: targetPage };
}

export async function listPages(port = DEFAULT_PORT) {
  const browserURL = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.connect({ browserURL });
  const pages = await browser.pages();
  const result = pages.map(p => ({ url: p.url(), title: p.url() }));
  await browser.disconnect();
  return result;
}
