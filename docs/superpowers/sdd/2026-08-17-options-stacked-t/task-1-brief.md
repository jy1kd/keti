### Task 1: 合成标底合约 `syntheticUnderlyingContract`

**Files:**
- Modify: `frontend/src/modules/market/sort.ts`（在 `groupOptionsByUnderlying` 之后新增函数）
- Test: `frontend/src/modules/market/sort.test.ts`

**Interfaces:**
- Consumes: `deriveUnderlyingProduct(underlyingInstrID: string): string`、`getProductName(productID: string): string`（已存在）
- Produces: `syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo` —— 供 Task 5 / OptionsPanel 在 `underlying === undefined` 时使用。

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/modules/market/sort.test.ts 末尾 describe 外新增：
describe('syntheticUnderlyingContract', () => {
  it('指数期权标底合成：productClass=1、isTrading=0、品种/中文名映射', () => {
    const c = syntheticUnderlyingContract('MO2608')
    expect(c.instrumentID).toBe('MO2608')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
    expect(c.productID).toBe('MO')
    expect(c.instrumentName).toBe('中证1000期权')
  })
  it('真实期货标底同格式但可交易标志由调用方决定（合成恒为不可交易）', () => {
    const c = syntheticUnderlyingContract('FG609')
    expect(c.instrumentID).toBe('FG609')
    expect(c.productClass).toBe('1')
    expect(c.isTrading).toBe(0)
  })
})
```

- [ ] **Step 2: 跑红**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/market/sort.test.ts`
Expected: FAIL `syntheticUnderlyingContract is not defined`

- [ ] **Step 3: 最小实现**

```ts
// frontend/src/modules/market/sort.ts 顶部 import 增加 getProductName：
import { getProductName } from '@/utils/productNames'
// 在 groupOptionsByUnderlying 函数之后新增：
/** 标的不可订阅时（指数期权 MO/IO/HO 的 underlyingInstrID 非期货），
 * 合成一条仅作组头的标底合约：productClass='1'（走 underlying 红粗渲染分支），
 * isTrading=0（不可下单/不可订阅）。 */
export function syntheticUnderlyingContract(underlyingInstrID: string): ContractInfo {
  const productID = deriveUnderlyingProduct(underlyingInstrID)
  return {
    instrumentID: underlyingInstrID,
    instrumentName: getProductName(productID),
    exchangeID: '',
    productID,
    volumeMultiple: 0,
    priceTick: 0,
    expireDate: '',
    isTrading: 0,
    productClass: '1',
    underlyingInstrID: undefined,
    optionsType: undefined,
    strikePrice: undefined,
  }
}
```

- [ ] **Step 4: 跑绿**

Run: `cd frontend && node_modules/.bin/vitest run src/modules/market/sort.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/modules/market/sort.ts frontend/src/modules/market/sort.test.ts
git commit -m "feat(options): 合成标底合约工具（指数期权组头）"
```

