import type { CSSProperties, DependencyList, Dispatch, MutableRefObject, SetStateAction } from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

export interface Storage {
    getItem(key: string): string | null
    setItem(key: string, value: string): any
    removeItem(key: string): any
}

export interface StorageStateHookStringConfig {
    key: string
    storage: Storage
    parser?: (value: string | null) => string | null
    serializer?: (value: string | null) => string | null
}

export interface StorageStateHookDataConfig<Data> {
    key: string
    storage: Storage
    parser: (value: string | null) => Data
    serializer: (value: Data) => string | null
}

export function useStorageState(config: StorageStateHookStringConfig): [string | null, Dispatch<SetStateAction<string | null>>]
export function useStorageState<Data>(config: StorageStateHookDataConfig<Data>): [Data, Dispatch<SetStateAction<Data>>]
export function useStorageState<Data>(config: StorageStateHookStringConfig | StorageStateHookDataConfig<Data>) {
    const { key, storage, parser, serializer } = config

    const [state, setState] = useState(() => {
        const value = storage.getItem(key)
        return parser ? parser(value) : value
    })

    useMemo(() => {
        const value = serializer ? serializer(state as any) : state
        if (value === null) {
            storage.removeItem(key)
        } else {
            storage.setItem(key, value as string)
        }
    }, [state])

    return [state, setState]
}

export function useLocalStorageState(key: string): [string | null, Dispatch<SetStateAction<string | null>>]
export function useLocalStorageState(key: string, config: Omit<StorageStateHookStringConfig, "storage" | "key">): [string | null, Dispatch<SetStateAction<string | null>>]
export function useLocalStorageState<Data>(key: string, config: Omit<StorageStateHookDataConfig<Data>, "storage" | "key">): [Data, Dispatch<SetStateAction<Data>>]
export function useLocalStorageState<Data>(key: string, config?: Omit<StorageStateHookStringConfig | StorageStateHookDataConfig<Data>, "storage" | "key">) {
    const c = { key, storage: localStorage, ...config }
    return useStorageState(c as any)
}

export function useSessionStorageState(key: string): [string | null, Dispatch<SetStateAction<string | null>>]
export function useSessionStorageState(key: string, config: Omit<StorageStateHookStringConfig, "storage" | "key">): [string | null, Dispatch<SetStateAction<string | null>>]
export function useSessionStorageState<Data>(key: string, config: Omit<StorageStateHookDataConfig<Data>, "storage" | "key">): [Data, Dispatch<SetStateAction<Data>>]
export function useSessionStorageState<Data>(key: string, config?: Omit<StorageStateHookStringConfig | StorageStateHookDataConfig<Data>, "storage" | "key">) {
    const c = { key, storage: sessionStorage, ...config }
    return useStorageState(c as any)
}

function isAsyncGenerator(value: AsyncGenerator<void, void, void> | Promise<void>): value is AsyncGenerator<void, void, void> {
    return typeof (value as AsyncGenerator<void, void, void>)[Symbol.asyncIterator] === "function"
}

export function useAsync(effect: () => AsyncGenerator<void, void, void> | Promise<void>, deps?: DependencyList): void
export function useAsync(effect: () => AsyncGenerator<void, void, void> | Promise<void>, callback: () => void, deps?: DependencyList): void
export function useAsync(effect: () => AsyncGenerator<void, void, void> | Promise<void>, callbackOrDeps?: (() => void) | DependencyList, deps?: DependencyList) {
    const dependencyList = typeof callbackOrDeps === "function" ? deps : callbackOrDeps
    useEffect(() => {
        const generator = effect()
        let stop = false
        async function run() {
            if (isAsyncGenerator(generator)) {
                while (true) {
                    const result = await generator.next()
                    if (result.done || stop) {
                        generator.return()
                        break
                    }
                }
            }
        }
        run()
        return () => {
            stop = true
            if (typeof callbackOrDeps === "function") {
                callbackOrDeps()
            }
        }
    }, dependencyList)
}

export interface ScrollMemoOptions {
    /** 需要监听的元素，可以是 ref */
    target: HTMLElement | null | MutableRefObject<HTMLElement | null>
    /** 用于存储位置的存储器，默认是 sessionStorage */
    storage?: Storage
    /** 存储位置的 key */
    key: string
    /** 是否已经准备好 */
    ready?: boolean
    /** 是否延迟滚动，这对于一些重绘需要时间的场景很有用 */
    delay?: number
    /** 滚动行为 */
    behavior?: ScrollBehavior
}

export function useScrollMemo(options: ScrollMemoOptions) {
    const { target, storage = sessionStorage, key, ready = true, delay, behavior } = options
    useEffect(() => {
        if (!ready) return
        if (target === null) return
        const element = target instanceof HTMLElement ? target : target.current
        if (element === null) return
        let timeout: any = undefined
        try {
            const value = storage.getItem(key)
            if (value === null) throw new Error()
            const { left, top } = JSON.parse(value)
            if (typeof left === "number" && typeof top === "number") {
                if (typeof delay !== "number" || Number.isNaN(delay) || delay <= 0) {
                    element.scrollTo({ left, top, behavior })
                } else {
                    timeout = setTimeout(() => {
                        element.scrollTo({ left, top, behavior })
                    }, delay)
                }
            }
        } catch (error) {}
        function listener(e: Event) {
            const { scrollLeft, scrollTop } = e.target as HTMLElement
            storage.setItem(key, JSON.stringify({ left: scrollLeft, top: scrollTop }))
        }
        element.addEventListener("scroll", listener)
        return () => {
            clearTimeout(timeout)
            element.removeEventListener("scroll", listener)
        }
    }, [target, storage, key, ready, behavior])
}

/**
 * 在 react 中比较数组是否发生变化
 */
export function useArraySignal<T>(data: T[], compareFn?: (a: T, b: T) => boolean) {
    const dataRef = useRef(data)
    const signal = useRef(Symbol("arraySignal"))
    if (data !== dataRef.current && (dataRef.current.length !== data.length || dataRef.current.some((it, idx) => (compareFn ? !compareFn(it, data[idx]) : it !== data[idx])))) {
        signal.current = Symbol("arraySignal")
        dataRef.current = data
    }
    return signal.current
}

export type QueryToStateFnMap = Record<string, ((value: string | null, values: string[]) => any) | undefined>

export type StateToQueryFnMap<T extends QueryToStateFnMap> = {
    [K in keyof T]?: (value: T[K] extends (...args: any[]) => infer R ? R : string | undefined) => string | null | undefined | string[]
}

export type QueryStateOptions<T extends string = never, K extends QueryToStateFnMap = QueryToStateFnMap> = {
    keys?: T[]
    parse?: K
    stringify?: StateToQueryFnMap<K>
    deps?: any[]
}

export type QueryState<T extends string = never, K extends QueryToStateFnMap = QueryToStateFnMap> = {
    [Key in T | keyof K]: Key extends keyof K ? (K[Key] extends (...args: any[]) => infer R ? R : string | undefined) : string | undefined
}

export function compareArray(a: any[], b: any[]) {
    return a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
}

export function compareSearch(a: Record<string, string[]>, b: Record<string, string[]>) {
    return compareArray(Object.keys(a), Object.keys(b)) && Object.keys(a).every(key => compareArray(a[key], b[key]))
}

export type SetQueryState<T extends string, K extends QueryToStateFnMap> = (state: Partial<QueryState<T, K>> | ((prevState: QueryState<T, K>) => Partial<QueryState<T, K>>)) => void

export function useOriginalQueryState<T extends string = never, K extends QueryToStateFnMap = QueryToStateFnMap>(searchParams: URLSearchParams, setSearchParams: (next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => void, options?: QueryStateOptions<T, K>): [QueryState<T, K>, SetQueryState<T, K>] {
    const { keys = [], parse = {}, stringify = {}, deps = [] } = options || {}
    const totalKeys = (keys as string[]).concat(Object.keys(parse))
    const search = totalKeys.reduce((prev: Record<string, string[]>, key) => {
        prev[key] = searchParams.getAll(key)
        return prev
    }, {})
    const cache = useRef({ searchParams, setSearchParams, search, parse, stringify, deps })
    cache.current.searchParams = searchParams
    cache.current.setSearchParams = setSearchParams
    if (!compareSearch(cache.current.search, search) || !compareArray(cache.current.deps, deps)) {
        cache.current = { searchParams, setSearchParams, search, parse, stringify, deps }
    }
    const queryState: QueryState<T, K> = useMemo(() => {
        return Object.entries(search).reduce((prev: Record<string, any>, [key, values]) => {
            const value = values[0] ?? undefined
            const parser = (parse as any)[key]
            prev[key] = parser ? parser(value, values) : value
            return prev
        }, {}) as any
    }, [cache.current])
    const queryStateRef = useRef(queryState)
    queryStateRef.current = queryState
    const setQueryState: SetQueryState<T, K> = useCallback(state => {
        const newState = typeof state === "function" ? state(queryStateRef.current) : state
        const { searchParams, setSearchParams, search, parse, stringify } = cache.current
        const newSearchParams = new URLSearchParams(searchParams)
        Object.keys(search).forEach(key => {
            const value = newState[key]
            const stringifier = (stringify as any)[key]
            if (!stringifier) {
                if (value === undefined || value === null) {
                    newSearchParams.delete(key)
                    return
                }
                if (Array.isArray(value)) {
                    newSearchParams.delete(key)
                    value.forEach(item => newSearchParams.append(key, String(item)))
                    return
                }
                newSearchParams.set(key, String(value))
                return
            }
            const newValue = stringifier(value)
            if (newValue === undefined || newValue === null) {
                newSearchParams.delete(key)
                return
            }
            if (Array.isArray(newValue)) {
                newSearchParams.delete(key)
                newValue.forEach(item => newSearchParams.append(key, String(item)))
                return
            }
            newSearchParams.set(key, String(newValue))
        })
        setSearchParams(newSearchParams)
    }, [])
    return [queryState, setQueryState]
}

/**
 * 使用 React Router 的 useSearchParams 实现的 useQueryState
 */
export function useQueryState<T extends string = never, K extends QueryToStateFnMap = QueryToStateFnMap>(options?: QueryStateOptions<T, K>): [QueryState<T, K>, SetQueryState<T, K>] {
    const [searchParams, setSearchParams] = useSearchParams()
    return useOriginalQueryState(searchParams, setSearchParams, options)
}

/**
 * 使用原生的 URLSearchParams 实现的 useNativeQueryState
 */
export function useNativeQueryState<T extends string = never, K extends QueryToStateFnMap = QueryToStateFnMap>(options?: QueryStateOptions<T, K>): [QueryState<T, K>, SetQueryState<T, K>] {
    const searchParams = new URLSearchParams(window.location.search)
    function setSearchParams(next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) {
        const newSearchParams = typeof next === "function" ? next(searchParams) : next
        const search = newSearchParams.toString()
        const url = new URL(window.location.href)
        url.search = search
        window.history.replaceState(null, "", url.toString())
    }
    return useOriginalQueryState(searchParams, setSearchParams, options)
}

export type ThirdPartyImageErrorHandlerTarget = HTMLElement | Window | Document | MutableRefObject<HTMLElement>

export interface ThirdPartyImageErrorHandlerOptions {
    target?: ThirdPartyImageErrorHandlerTarget
    content: string | [string, string]
    backgroundColor?: CSSProperties["backgroundColor"]
    fontSize?: CSSProperties["fontSize"]
    fontFamily?: CSSProperties["fontFamily"]
    color?: CSSProperties["color"]
    lineHeight?: CSSProperties["lineHeight"]
}

function targetIsMutableRefObject(target: ThirdPartyImageErrorHandlerTarget): target is MutableRefObject<HTMLElement> {
    return target !== null && typeof target === "object" && "current" in target && target.current instanceof HTMLElement
}

/** 
 * 用于处理第三方图片加载失败的 hook
 */
export function useThirdPartyImageErrorHandler(options: ThirdPartyImageErrorHandlerOptions) {
    const { target = window, content, backgroundColor, fontSize, color, lineHeight, fontFamily } = options
    const [before, after] = typeof content === "string" ? [content, undefined] : content
    useEffect(() => {
        function listener(e: Event) {
            const { target } = e
            // 判断是否是图片元素的错误
            if (!(target instanceof HTMLImageElement)) return
            const url = new URL(target.src)
            // 判断是否是第三方的图片
            if (url.origin === location.origin) return
            // 添加 data-third-party-image-error 属性
            target.dataset.thirdPartyImageError = ""
        }
        const instance = targetIsMutableRefObject(target) ? target.current : target
        instance.addEventListener("error", listener, true)
        return () => instance.removeEventListener("error", listener, true)
    }, [target])

    useLayoutEffect(() => {
        const style = document.createElement("style")
        function isNonNull<T>(value: T | null | undefined): value is T {
            return value !== null && value !== undefined
        }
        style.innerHTML = `[data-third-party-image-error] {
    position: relative;
}

[data-third-party-image-error]::before {
    content: "${before}";
    ${isNonNull(backgroundColor) ? `background-color: ${backgroundColor};` : ""}
    ${isNonNull(fontSize) ? `font-size: ${fontSize};` : ""}
    ${isNonNull(color) ? `color: ${color};` : ""}
    ${isNonNull(lineHeight) ? `line-height: ${lineHeight};` : ""}
    ${isNonNull(fontFamily) ? `font-family: ${fontFamily};` : ""}
    position: absolute;
    width: 100%;
    height: ${isNonNull(after) ? "50%" : "100%"};
    left: 0;
    top: 0;
    display: flex;
    justify-content: center;
    align-items: ${isNonNull(after) ? "flex-end" : "center"};
}

${
    isNonNull(after)
        ? `[data-third-party-image-error]::after {
    content: "${after}";
    ${isNonNull(backgroundColor) ? `background-color: ${backgroundColor};` : ""}
    ${isNonNull(fontSize) ? `font-size: ${fontSize};` : ""}
    ${isNonNull(color) ? `color: ${color};` : ""}
    ${isNonNull(lineHeight) ? `line-height: ${lineHeight};` : ""}
    ${isNonNull(fontFamily) ? `font-family: ${fontFamily};` : ""}
    position: absolute;
    width: 100%;
    height: 50%;
    left: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
}`
        : ""
}`
        document.head.appendChild(style)
        return () => {
            document.head.removeChild(style)
        }
    }, [before, after, backgroundColor, fontSize, color, lineHeight, fontFamily])
}
