# 第三方词典来源

本项目内置 ECDICT 筛选词库，共 8,560 个去重词条；词书是资料分类，不是默认学习 List。

- 原始项目：https://github.com/skywind3000/ECDICT
- 下载分发：npm `ecdict@0.0.4` 包中的 `assets/ecdict.csv`
- 分发包 SHA-1：aadfa6e46ed9c586144a3f749d585111168ec5f2
- 原始 CSV SHA-256：d0ce61e560b50d9905d20de3173aa3ca80950ce235bedd21c53e025cf9f38cb0
- 分发包 MIT 许可随应用保存于 `public/dictionaries/ECDICT-LICENSE.txt`
- ECDICT 上游当前 MIT 许可保存于 `public/dictionaries/ECDICT-UPSTREAM-LICENSE.txt`
- 构建脚本：`scripts/build-dictionary.py`
- 构建日期：2026-10-23

## 内容覆盖

常用英语 3,461 词；四级 3,846 词；六级 5,406 词；雅思 5,040 词。
各词书有重合，词书数量不能相加作为去重总量。分类沿用 ECDICT 标签，不代表最新考试大纲认证。

保留原词典的中文释义、英文解释、音标、词形变化。缺失字段为空，没有生成虚构例句或音频。
发音使用系统英语语音，是否可离线发声取决于本机是否安装英语语音包。

## 重新构建

下载 `ecdict@0.0.4` 分发包，只提取 `assets/ecdict.csv` 到 `data-sources/ecdict.csv`，将包内 `LICENSE` 保存为 `data-sources/ECDICT-LICENSE.txt`。
在项目目录执行 `python scripts/build-dictionary.py`，再执行 `npm run build`。
脚本只输出资料库，不会修改用户 List。用户 List 保存在当前浏览器或桌面应用的本地数据区，浏览器与桌面应用不共享该数据。
