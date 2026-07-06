# 职业标准能力图谱生成器

基于 Vue 3 + Vite 的单页应用，用于将国家职业标准文本分析为：

- 能力矩阵
- 能力图谱
- 支撑知识图谱

## 当前实现

- 支持粘贴标准文本
- 支持导入 `TXT`、`MD`、`DOCX`、`PDF`
- 支持两种分析模式
- `本地规则分析`：无需外部接口，可直接体验流程
- `AI 接口分析`：默认接入 DeepSeek，兼容 `Chat Completions` 风格接口
- 支持导出：
- 能力矩阵 `CSV`
- 能力图谱 `JSON`、`PNG`
- 知识图谱 `JSON`、`PNG`
- 完整分析结果 `JSON`

## 启动

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

## AI 接口说明

页面切换到 `AI 接口分析` 后，填写：

- `接口地址`：默认 `https://api.deepseek.com`
- `模型名`：默认 `deepseek-chat`
- `API Key`：DeepSeek API Key

要求接口兼容：

- `POST /chat/completions`

## 说明

当前版本优先实现最小可用链路，因此：

- 未包含独立后端
- 未做用户登录、任务历史、数据库持久化
- 本地规则分析属于启发式建模，适合演示和流程验证
- 真实生产分析建议使用 AI 接口模式，并根据职业标准语料继续调优提示词或补充后端校验
