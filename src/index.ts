import type { DependencyList, Dispatch, MutableRefObject, SetStateAction } from "react"
import { useEffect, useMemo, useState } from "react"

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
