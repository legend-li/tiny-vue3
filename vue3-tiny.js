let effectStack = [] // 存储 effect
let targetMap = new WeakMap() // 存储 target 的属性的监听者依赖 Map

const baseHandler = {
  get (target, key) {
    // 收集监听者依赖
    let data = Reflect.get(target, key)
    track(target, key)
    return typeof data === 'object' ? reactive(data) : data
  },
  set (target, key, val) {
    // 触发数据更新，并且运行target.key的监听者依赖
    Reflect.set(target, key, val)
    let data = {
      oldValue: target[key],
      newValue: val,
    }
    trigger(target, key, data)
  },
}

function reactive (target) {
  // 生成响应式数据
  let observed = new Proxy(target, baseHandler)
  // 返回响应式数据
  return observed
}

function computed (fn) {
  // computed 就是一个特殊的 effect
  let e = effect(fn, { computed: true, lazy: true })
  return {
    effect: e,
    get value () {
      return e()
    }
  }
}

function effect (fn, options = {}) {
  let e = createReactiveEffect(fn, options)
  if (!options.lazy) {
    e()
  }
  return e
}

function createReactiveEffect (fn, options) {
  function effect (...args) {
    return run(effect, fn, args)
  }
  effect.deps = []
  effect.computed = options.computed
  effect.lazy = options.lazy
  return effect
}

function run (effect, fn, args) {
  if (effectStack.indexOf(effect) === -1) {
    try {
      effectStack.push(effect)
      return fn(args)
    } finally {
      effectStack.pop()
    }
  }
}

function track (target, key) {
  let effect = effectStack[effectStack.length-1]
  if (effect) {
    let depMap = targetMap.get(target)
    if (!depMap) {
      depMap = new Map()
      targetMap.set(target, depMap)
    }
    let dep = depMap.get(key)
    if (!dep) {
      dep = new Set()
      depMap.set(key, dep)
    }
    if (!dep.has(effect)) {
      dep.add(effect)
      effect.deps.push(dep)
    }
  }
}

function trigger (target, key, data) {
  let depMap = targetMap.get(target)
  if (!depMap) return
  let computedEffects = new Set()
  let effects = new Set()
  let deps = depMap.get(key)
  if (!deps) return
  deps.forEach(e => {
    if (e.computed) {
      computedEffects.add(e)
    } else {
      effects.add(e)
    }
  })
  effects.forEach(e => e())
  computedEffects.forEach(e => e())
}