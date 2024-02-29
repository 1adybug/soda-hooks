import { Dispatch, SetStateAction, useMemo, useState } from "react"

export interface Storage {
    getItem(key: string): string | null
    setItem(key: string, value: string): any
    removeItem(key: string): any
}

export interface StorageStateHookStringConfig {
    key: string
    storage: Storage
    parser?: (value: string | null) => string | null
    serializer?: (value: string | null) => string
}

export interface StorageStateHookDataConfig<Data> {
    key: string
    storage: Storage
    parser: (value: string | null) => Data
    serializer: (value: Data) => string
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

export function useSessionStorageState(key: string): [string | null, Dispatch<SetStateAction<string | null>>]
export function useSessionStorageState<Data>(config: Omit<StorageStateHookDataConfig<Data>, "storage">): [Data, Dispatch<SetStateAction<Data>>]
export function useSessionStorageState<Data>(keyOrConfig: string | Omit<StorageStateHookDataConfig<Data>, "storage">) {
    const config = typeof keyOrConfig === "string" ? { key: keyOrConfig, storage: sessionStorage } : { ...keyOrConfig, storage: sessionStorage }
    return useStorageState(config as any)
}

export function useLocalStorageState(key: string): [string | null, Dispatch<SetStateAction<string | null>>]
export function useLocalStorageState<Data>(config: Omit<StorageStateHookDataConfig<Data>, "storage">): [Data, Dispatch<SetStateAction<Data>>]
export function useLocalStorageState<Data>(keyOrConfig: string | Omit<StorageStateHookDataConfig<Data>, "storage">) {
    const config = typeof keyOrConfig === "string" ? { key: keyOrConfig, storage: localStorage } : { ...keyOrConfig, storage: localStorage }
    return useStorageState(config as any)
}
