# staging 验收记录（Chrome / Edge + Tampermonkey）

手动验收在真实浏览器中执行；本表提交时只包含勾选结果、版本号、测试日期、浏览器版本与记录数。
**不提交**截图文件、HAR、岗位正文、简历、账号信息、Cookie 或 API Key（证据文件名仅作现场占位）。

- BossFetcher 版本：`0.1.0`
- 验收日期：待填
- Chrome 版本：待填
- Edge 版本：待填
- Tampermonkey 版本：待填

| Check | Chrome | Edge | Evidence |
|---|---|---|---|
| Tampermonkey official installation opens | [ ] | [ ] | screenshot filename |
| Allow User Scripts is explicitly enabled | [ ] | [ ] | screenshot filename |
| bossfetcher.user.js opens Tampermonkey confirmation | [ ] | [ ] | screenshot filename |
| install page detects ready/version | [ ] | [ ] | version shown |
| one real BOSS job is captured | [ ] | [ ] | test job ID only |
| `/app` displays the captured record | [ ] | [ ] | count only |
| pause and resume work on BOSS page | [ ] | [ ] | observed state sequence |
| JSON backup, clear, replace restore work | [ ] | [ ] | counts/checksum only |
| Network contains no job, resume or API key request to BossFetcher | [ ] | [ ] | HAR review result; do not commit HAR |
| DNT and local opt-out send no stats requests | [ ] | [ ] | Network review result |

## 证据规则

- 截图只保存在本地验收目录，仓库只记录文件名；
- HAR 只用于现场审查后删除，仓库只记录审查结论；
- 岗位只记录测试用 job ID 与记录数，不记录标题/正文/公司信息；
- 每次验收需注明浏览器与扩展版本，便于回归对比。
