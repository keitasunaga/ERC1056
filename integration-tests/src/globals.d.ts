// Jestのグローバル関数の型定義
declare global {
  const describe: (name: string, fn: () => void) => void;
  const it: (name: string, fn: () => void) => void;
  const test: (name: string, fn: () => void) => void;
  const expect: any;
  const beforeAll: (fn: () => void) => void;
  const beforeEach: (fn: () => void) => void;
  const afterAll: (fn: () => void) => void;
  const afterEach: (fn: () => void) => void;
  const jest: any;
}

export { }; 