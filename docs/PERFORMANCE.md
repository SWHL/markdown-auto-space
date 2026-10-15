# 性能基准

仓库提供 `pnpm test:benchmark` 用于回归大文档性能。基准固定生成 100,000 行 Markdown，并报告：

- 格式化耗时（`processMarkdownContent`）
- 生成的最小编辑数量
- Node.js 堆内存增量
- MDX/ 大文档保护扫描耗时

默认回归阈值为：格式化中位数小于 5 秒、保护扫描小于 2 秒、单次格式化堆内存增量小于 256 MiB。格式化耗时先预热，再取 3 次样本的中位数；编辑数量从已经生成的格式化结果计算，不会再次格式化。测试运行时会通过 Vitest 输出实际指标；阈值是跨机器的上限，用于捕获明显退化，不用于比较微小的运行时波动。

诊断编辑 debounce 的契约固定为 300 ms（`DIAGNOSTICS_DEBOUNCE_MS`）。`test/performance.test.ts` 会断言该值，避免无意改变 debounce 后造成频繁扫描或测试失真。需要调整阈值时，应同时记录基准机器、Node.js 版本和调整原因。

```bash
pnpm test:benchmark
```

常规单元测试仍由 `pnpm test` 执行；性能基准单独运行以避免把机器负载和基准输出混入每次快速测试。
