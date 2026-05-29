const NOISY_MEANING_MARKERS = [
  "DOS",
  "命令",
  "计算机",
  "汇编",
  "总线",
  "累加器",
  "加法器",
  "存储器",
  "检索时间",
  "运行时间",
  "控制标志",
  "通信多路转换器",
  "磁心存储器",
  "化学元素",
  "号元素",
  "输入终端",
  "智能终端",
  "后端",
  "汇合指令",
  "实用程序",
  "制造自动化协议"
];

const NOISY_MEANING_PATTERNS = [
  /按任意键继续/
];

const WORD_SPECIFIC_NOISY_PARTS = {
  a: ["地址", "振幅", "模拟", "区域", "面积", "组件", "异步"]
};

export function cleanDisplayTranslation(cn, word = "") {
  const raw = String(cn || "").trim();
  if (!raw) return "";
  const wordKey = String(word || "").toLowerCase();
  const wordSpecificNoisyParts = WORD_SPECIFIC_NOISY_PARTS[wordKey] || [];

  const seen = new Set();
  const parts = raw
    .split(/[;；,，]/)
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !NOISY_MEANING_MARKERS.some(marker => part.includes(marker)))
    .filter(part => !NOISY_MEANING_PATTERNS.some(pattern => pattern.test(part)))
    .filter(part => !wordSpecificNoisyParts.includes(part))
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  return parts.length ? parts.join("；") : raw;
}
