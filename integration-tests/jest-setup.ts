// Jest グローバル関数と型の定義
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, test, jest } from '@jest/globals';

// グローバルスコープにJest関数を追加
// @ts-ignore (型の互換性エラーを無視する)
global.describe = describe;
// @ts-ignore
global.it = it;
// @ts-ignore
global.expect = expect;
// @ts-ignore
global.beforeAll = beforeAll;
// @ts-ignore
global.beforeEach = beforeEach;
// @ts-ignore
global.afterAll = afterAll;
// @ts-ignore
global.afterEach = afterEach;
// @ts-ignore
global.test = test;
// @ts-ignore
global.jest = jest; 