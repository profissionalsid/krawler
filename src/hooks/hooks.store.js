import _ from 'lodash'
import zlib from 'zlib'
import makeDebug from 'debug'
import { addOutput, getStoreFromHook, writeStreamToStore, callOnHookItems, templateObject } from '../utils'

const debug = makeDebug('krawler:hooks:store')

// Create a new (set of) store(s)
export function createStores (options = {}) {
  return async function (hook) {
    if (hook.type !== 'before') {
      throw new Error(`The 'createStore' hook should only be used as a 'before' hook.`)
    }

    // Transform to array
    const faultTolerant = options.faultTolerant
    let stores = []
    if (!Array.isArray(options)) {
      if (options.stores) stores = options.stores
      else stores = [options]
    } else {
      stores = options
    }

    for (let i = 0; i < stores.length; i++) {
      const storeOptions = stores[i]
      debug('Looking for store ' + storeOptions.id)
      let store
      try {
        // Check if store does not already exist
        store = await hook.service.storesService.get(storeOptions.id)
        if (storeOptions.storePath) _.set(hook.data, storeOptions.storePath, store)
        debug('Found existing store ' + storeOptions.id)
      } catch (error) {
        debug('Creating store for ' + hook.data.id + ' with options ', storeOptions)
        try {
          store = await hook.service.storesService.create(storeOptions)
          if (storeOptions.storePath) _.set(hook.data, storeOptions.storePath, store)
        } catch (error) {
          if (faultTolerant) {
            debug('Could not create store for ' + hook.data.id)
            console.log(error)
          } else {
            throw error
          }
        }
      }
    }

    return hook
  }
}

// Remove an existing (set of) store(s)
export function removeStores (options = {}) {
  return async function (hook) {
    if ((hook.type !== 'after') && (hook.type !== 'error')) {
      throw new Error(`The 'removeStore' hook should only be used as a 'after/error' hook.`)
    }

    // Transform to array
    let stores = []
    if (!Array.isArray(options)) {
      if (options.stores) options = options.stores
      else stores = [options]
    } else {
      stores = options
    }

    for (let i = 0; i < stores.length; i++) {
      const storeOptions = stores[i]
      const id = (typeof storeOptions === 'string' ? storeOptions : storeOptions.id)
      debug('Removing store ' + id + ' for ' + hook.data.id)
      await hook.service.storesService.remove(id)
      if (storeOptions.storePath) _.unset(hook.data, storeOptions.storePath)
    }

    return hook
  }
}

export function copyToStore (options = {}) {
  async function copy (item, hook) {
    // Output store config given in options
    const outputOptions = templateObject(item, options.output, ['key'])
    let outStore = await hook.service.storesService.get(outputOptions.store)
    const inputOptions = templateObject(item, options.input, ['key'])
    let inStore = await getStoreFromHook(hook, 'copyToStore', inputOptions)
    debug('Copying to store', inputOptions, outputOptions)
    await writeStreamToStore(inStore.createReadStream(inputOptions), outStore, outputOptions)
    addOutput(item, outputOptions.key, outputOptions.outputType)
  }

  return callOnHookItems(copy)
}

export function gzipToStore (options = {}) {
  async function gzip (item, hook) {
    // Output store config given in options
    const outputOptions = templateObject(item, options.output, ['key'])
    let outStore = await hook.service.storesService.get(outputOptions.store)
    const inputOptions = templateObject(item, options.input, ['key'])
    let inStore = await getStoreFromHook(hook, 'gzipToStore', inputOptions)
    debug('Gzipping to store', inputOptions, outputOptions)
    await writeStreamToStore(inStore.createReadStream(inputOptions).pipe(zlib.createGzip(options)), outStore, outputOptions)
    addOutput(item, outputOptions.key, outputOptions.outputType)
  }

  return callOnHookItems(gzip)
}

export function gunzipFromStore (options = {}) {
  async function gunzip (item, hook) {
    // Output store config given in options
    const outputOptions = templateObject(item, options.output, ['key'])
    let outStore = await hook.service.storesService.get(outputOptions.store)
    const inputOptions = templateObject(item, options.input, ['key'])
    let inStore = await getStoreFromHook(hook, 'gunzipFromStore', inputOptions)
    debug('Gunzipping from store', inputOptions, outputOptions)
    await writeStreamToStore(inStore.createReadStream(inputOptions).pipe(zlib.createGunzip(options)), outStore, outputOptions)
    addOutput(item, outputOptions.key, outputOptions.outputType)
  }

  return callOnHookItems(gunzip)
}
