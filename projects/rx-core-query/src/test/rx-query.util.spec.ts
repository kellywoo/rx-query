import {autobind, deepEqual, shallowEqualDepth} from 'rx-ng-query';

describe('autobind', () => {
  class Hello {
    constructor(private name: string) {}
    @autobind
    sayHello() {
      return `hello, ${this.name}`;
    }
  }
  it('this is bound', () => {
    const hello1 = new Hello('kelly');
    const hello2 = new Hello('Dave');
    const { sayHello } = hello1;

    expect(sayHello()).toBe(hello1.sayHello());
    expect(sayHello()).not.toBe(hello2.sayHello());
  });

  it('setter should work for the instance only', () => {
    const hello1 = new Hello('kelly');
    const hello2 = new Hello('Dave');
    hello1.sayHello = function () {
      return `hi, ${(this as any).name}`;
    };

    expect(hello1.sayHello()).toBe('hi, kelly');
    expect(hello2.sayHello()).toBe('hello, Dave');
  });
});

function createObject(org: any, num: number, child?: any): any {
  const target = child || org;

  if (num > 1) {
    target[num] = {};
    return createObject(org, num - 1, target[num]) as any;
  }
  if (num === 1) {
    target[num] = 1;
  }
  return org as any;
}

describe('deepEqual', () => {

  it('should same', () => {
    const a = createObject({}, 20);
    const b = createObject({}, 20);
    expect(deepEqual(a, b)).toBe(true);
  });
  it('should same for long depth', () => {
    const a = createObject({}, 20);
    const b = createObject({}, 20);
    expect(deepEqual(a, b)).toBe(true);
  });

  it('should not same for different depth', () => {

    const a = createObject({}, 20);
    const b = createObject({}, 21);
    expect(deepEqual(a, b)).toBe(false);
  });

  it('check for undefined', () => {
    const a = { 1: true, 2: undefined };
    const b = { 1: true };
    expect(deepEqual(a, b)).toBe(false);
  });

  it('should same for Date', () => {
    const now = Date.now();
    expect(deepEqual(new Date(now), new Date(now))).toBe(true);
  });
});


describe('shallowEqualDepth', () => {
  it('should not same for different depth', () => {
    class S {}
    class S1 extends S {}

    const a = {}
    const b = 5;
    const c = new Date();
    const d = Symbol();
    const e = new S();
    const f = new S1();
    const A = {a, b, c, d, e, f};
    const B =  {a, b, c, d, e, f};
    expect(shallowEqualDepth(A, B)).toBe(true);
  });

  it('check for undefined', () => {
    const a = { 1: true, 2: undefined };
    const b = { 1: true };
    expect(shallowEqualDepth(a, b)).toBe(false);
  });

  it('should same for on depth 1', () => {
    const a = createObject({}, 2);
    const b = createObject({}, 2);
    expect(shallowEqualDepth(a, b, 3)).toBe(true);
  });

  it('should same for on depth 20', () => {
    const a = createObject({}, 20);
    const b = createObject({}, 20);
    expect(shallowEqualDepth(a, b, 21)).toBe(true);
  });
});
