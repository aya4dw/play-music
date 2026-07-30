import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const songs = [
  "猜不透 丁当", "小情歌 苏打绿", "他一定很爱你 阿杜", "我想更懂你 潘玮柏",
  "晴天 周杰伦", "有何不可 许嵩", "天真 弦子", "挥着翅膀的女孩 容祖儿",
  "我爱的人 陈小春", "千千阙歌 陈慧娴", "明天你好 牛奶咖啡", "可能 程响",
  "你不知道的事 王力宏", "爱你 王心凌", "空山新雨后 锦零", "海芋恋 萧敬腾",
  "这世界那么多人 莫文蔚", "一笑倾城 汪苏泷", "曾经的你 许巍", "一剪梅 费玉清",
  "舞女 陈小云", "忘记时间 胡歌", "不良人 河图", "如愿 王菲",
  "会呼吸的痛 梁静茹", "消愁 毛不易", "别找我麻烦 蔡健雅", "一场游戏一场梦 王杰",
  "是风动 银临", "心墙 郭静", "水手 郑智化", "就是爱你 陶喆",
  "我们的爱 飞儿乐团", "向天再借五百年 韩磊", "奔跑 羽泉", "相思 毛阿敏",
  "情锁 蔡琴", "朋友 谭咏麟", "处处吻 杨千嬅", "洋葱 杨宗纬",
  "家后 江蕙", "年轮 张碧晨", "贝加尔湖畔 李健", "隐形的翅膀 张韶涵",
  "听海 张惠妹", "说爱你 蔡依林", "父亲 筷子兄弟", "偷心 张学友",
  "去有风的地方 郁可唯", "恋曲1990 罗大佑", "无赖 郑中基", "囚鸟 张宇",
  "星月神话 金莎", "一次就好 房东的猫", "江南 林俊杰", "挪威的森林 伍佰",
  "断点 张敬轩", "征服 那英", "你那么爱她 李圣杰", "桃花诺 邓紫棋",
  "最美的太阳 张杰", "十年 陈奕迅", "小美满 周深", "因为爱所以爱 谢霆锋",
  "红颜 胡彦斌", "鬼迷心窍 李宗盛", "演员 薛之谦", "后来 刘若英",
  "五十年以后 海来阿木", "让我欢喜让我忧 周华健", "无所谓 杨坤", "情非得已 庾澄庆",
  "输了你赢了世界又如何 林志炫", "有心人 张国荣", "一起走过的日子 刘德华",
  "突然好想你 五月天", "2002年的第一场雪 刀郎", "晚风心里吹 刘惜君",
  "那就这样吧 动力火车", "潇洒走一回 叶倩文", "爱如潮水 张信哲",
  "分分钟需要你 林子祥", "遇见 孙燕姿", "再见只是陌生人 庄心妍",
  "飞鸟和蝉 任然", "你曾是少年 S.H.E", "大海 张雨生", "黄昏 周传雄",
  "奢香夫人 凤凰传奇", "身骑白马 徐佳莹", "我只在乎你 邓丽君", "心太软 任贤齐",
  "下一站天后 Twins", "暧昧 杨丞琳", "拯救 孙楠", "刚好遇见你 李玉刚",
  "至少还有你 林忆莲", "西厢 后弦", "光辉岁月 Beyond"
];

const outputDir = join(homedir(), 'Music', '一人一首成名曲');
const playMusic = join(process.cwd(), 'dist', 'index.js');

console.log(`Downloading ${songs.length} songs to: ${outputDir}\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < songs.length; i++) {
  const song = songs[i];
  const num = String(i + 1).padStart(3, '0');
  process.stdout.write(`[${num}/${songs.length}] ${song} ... `);
  
  // Try FLAC first, then 320k, then default
  try {
    execSync(`node "${playMusic}" download "${song}" -b flac -o "${outputDir}"`, {
      stdio: 'pipe',
      timeout: 120000,
    });
    console.log('OK (FLAC)');
    success++;
  } catch {
    try {
      execSync(`node "${playMusic}" download "${song}" -b 320k -o "${outputDir}"`, {
        stdio: 'pipe',
        timeout: 120000,
      });
      console.log('OK (320k)');
      success++;
    } catch {
      try {
        execSync(`node "${playMusic}" download "${song}" -o "${outputDir}"`, {
          stdio: 'pipe',
          timeout: 120000,
        });
        console.log('OK (default)');
        success++;
      } catch {
        console.log('FAILED');
        failed++;
      }
    }
  }
}

console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
