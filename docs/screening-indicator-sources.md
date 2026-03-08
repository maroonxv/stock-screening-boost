# Screening 指标数据来源梳理

## 当前项目已经接入的来源

### 1. 全市场实时报价快照
- 接口：`stock_zh_a_spot_em`
- 适合拿：
  - `code`
  - `name`
  - `pe`
  - `pb`
  - `marketCap`
  - `floatMarketCap`
- 现在项目里：
  - `python_services/app/services/akshare_adapter.py` 的 `get_all_stock_codes`
  - `python_services/app/services/akshare_adapter.py` 的 `get_stocks_by_codes`

### 2. 单股票历史财务指标
- 接口：`stock_financial_analysis_indicator`
- 适合拿：
  - `ROE`
  - `EPS`
  - 历史财务指标序列
- 现在项目里：
  - `python_services/app/services/akshare_adapter.py` 的 `get_indicator_history`
- 适合继续用于：
  - `ROE_AVG_3Y`
  - 其他需要单股票历史财务序列的时间序列指标

## 你下一步应该去补的接口

### 1. 行业字段
- 优先接口：`stock_individual_info_em`
- 适合拿：
  - `行业`
- 用途：
  - 补齐 `industry`
- 原因：
  - `stock_zh_a_spot_em` 文档里没有行业字段保证，直接从全市场快照拿行业不稳

### 2. 季报/年报横截面快照
- 优先接口：`stock_yjbb_em`
- 适合拿：
  - `每股收益`
  - `营业总收入-营业总收入`
  - `净利润-净利润`
  - `净资产收益率`
  - `所处行业`
- 用途：
  - 给全市场筛选时补齐最新一期 `EPS / REVENUE / NET_PROFIT / ROE / INDUSTRY`
- 原因：
  - 这个接口是“按报告期一次拉全市场”，比逐股票请求财务接口更适合 screening 场景

### 3. 资产负债表
- 优先接口：`stock_financial_debt_new_ths`
- 备选接口：`stock_financial_report_sina(stock="sh600600", symbol="资产负债表")`
- 适合拿：
  - 总资产
  - 总负债
  - 其他资产负债表科目
- 用途：
  - 计算 `DEBT_RATIO`
- 建议：
  - 直接在适配层把 `DEBT_RATIO = 总负债 / 总资产` 算出来，不要指望现成字段名永远稳定

### 4. 利润表
- 优先接口：`stock_financial_benefit_new_ths`
- 备选接口：`stock_financial_report_sina(stock="sh600600", symbol="利润表")`
- 适合拿：
  - 营业收入
  - 净利润
- 用途：
  - 计算 `REVENUE_CAGR_3Y`
  - 计算 `NET_PROFIT_CAGR_3Y`

## 建议的落地顺序

1. 用 `stock_yjbb_em` 做“全市场最新财务快照表”，补齐 `ROE / EPS / REVENUE / NET_PROFIT / INDUSTRY`
2. 用 `stock_individual_info_em` 兜底行业字段
3. 用 `stock_financial_debt_new_ths` 或 `stock_financial_report_sina(资产负债表)` 计算 `DEBT_RATIO`
4. 用 `stock_financial_benefit_new_ths` 或 `stock_financial_report_sina(利润表)` 做收入、利润的历史序列
5. 在 Python 服务层先把这些表做缓存和 join，再给 Next.js 返回统一 `StockData`

## 当前这次改造后的状态

- 时间序列条件已经修好，不再是“配置了但永远匹配不上”
- 执行链路已经改成异步队列，支持进度、取消和重试
- 硬编码候选池已经删掉
- 但指标覆盖面依然取决于 Python 服务实际补到哪些 AKShare 接口
- 所以你下一步最值得投入的，不是再做 UI，而是把 `stock_yjbb_em + stock_individual_info_em + stock_financial_debt_new_ths + stock_financial_benefit_new_ths` 这一层补齐
