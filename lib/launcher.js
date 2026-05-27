import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import net from 'net';
import path from 'path';

const DEFAULT_PORT = 9222;

// 从环境变量或常见安装路径查找闲鱼卖家客服
function findExePath() {
  // 优先使用环境变量
  if (process.env.XIANYU_EXE) return process.env.XIANYU_EXE;

  // 常见安装路径
  const candidates = [
    'C:/Users/*/AppData/Local/闲鱼卖家客服/闲鱼卖家客服.exe',
    'C:/Program Files/闲鱼卖家客服/闲鱼卖家客服.exe',
    'C:/Program Files (x86)/闲鱼卖家客服/闲鱼卖家客服.exe',
    'D:/闲鱼卖家客服/闲鱼卖家客服.exe',
  ];

  // 简单检查当前目录下的相对路径
  const localPath = './闲鱼卖家客服.exe';
  if (existsSync(localPath)) return path.resolve(localPath);

  return null;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port, '127.0.0.1');
  });
}

function isAppRunning() {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq 闲鱼卖家客服.exe" /FO CSV /NH', {
      encoding: 'utf8',
      timeout: 5000,
    });
    return out.includes('闲鱼卖家客服');
  } catch {
    return false;
  }
}

export async function launchApp(port = DEFAULT_PORT, exePath) {
  // 如果没指定路径，尝试自动查找
  if (!exePath) {
    exePath = findExePath();
  }
  if (!exePath || !existsSync(exePath)) {
    throw new Error(
      `找不到闲鱼卖家客服。\n\n` +
      `请先下载安装：\n` +
      `https://mtl.cn-hangzhou.oss.aliyun-inc.com/xianyu/seller/commonpro/xianyu-seller-im-1.0.4-win.exe\n\n` +
      `安装后通过 --exe 指定路径：\n` +
      `xianyu launch --exe "C:/Users/你的用户名/AppData/Local/闲鱼卖家客服/闲鱼卖家客服.exe"\n\n` +
      `或设置环境变量 XIANYU_EXE 指向安装路径。`
    );
  }

  // 检查端口是否已被占用
  const portBusy = await isPortInUse(port);
  if (portBusy) {
    const appRunning = isAppRunning();
    if (appRunning) {
      throw new Error(
        `闲鱼卖家客服已在运行，但未启用远程调试。\n` +
        `请先关闭闲鱼卖家客服，然后重新用 "xianyu launch" 启动。\n` +
        `或手动启动: "${EXE_PATH}" --remote-debugging-port=${port}`
      );
    } else {
      throw new Error(
        `端口 ${port} 已被其他程序占用。\n` +
        `请用 --port 指定其他端口，如: xianyu launch --port 9333`
      );
    }
  }

  const args = [`--remote-debugging-port=${port}`];
  const proc = spawn(exePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });

  proc.unref();
  return { pid: proc.pid, port };
}

export function getWsEndpoint(port = DEFAULT_PORT) {
  return `http://127.0.0.1:${port}`;
}
