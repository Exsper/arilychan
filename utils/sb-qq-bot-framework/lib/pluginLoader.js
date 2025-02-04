const glob = require('glob')
const path = require('path')
const slugify = require('slugify')

function getPlugins (selector = './lib/plugins/*/index.js') {
  const plugins = glob
    .sync(selector)
    .map((file) => {
      try {
        return {
          config: { path: path.resolve(file) },
          module: require(path.resolve(file))
        }
      } catch (e) {
        console.log(
          'unable to load plugin due to require error',
          path.resolve(file)
        )
        return undefined
      }
    })
    .filter((module) => module !== undefined)
  return plugins
}
async function usePlugin (app, { module: plugin, config }, logger = console) {
  // const file = config.file
  try {
    let expressApp
    let pluginData
    if (plugin.init) {
      pluginData = await plugin.init(config.options)
    }
    if (plugin.webApp) {
      expressApp = plugin.webApp
      if (expressApp) logger.log('got web apps for', plugin.name)
    }

    // if (config.subPlugin && plugin[config.subPlugin]) {
    //   plugin[config.subPlugin].apply(app, config.options, pluginData)
    // } else plugin.apply(app, config.options, pluginData)
    if (typeof plugin === 'function') app.plugin(plugin, config.options)
    else if (config.bypassLoader) app.plugin(plugin?.default ?? plugin, config.options)
    else {
      plugin.apply(app, config.options, pluginData)
    }
    if (expressApp) {
      return {
        expressApp,
        options: config.options,
        pluginData,
        name: plugin.name,
        path: config.webPath || plugin.webPath || `/${slugify(plugin.name)}`
      }
    }
  } catch (Error) {
    console.error(Error)
  } finally {
    logger.log(`Loaded plugin: ${plugin.name ? config.subPlugin === undefined ? plugin.name : `${plugin.name}(${plugin[config.subPlugin].name ? plugin[config.subPlugin].name : 'unnamed SubPlugin'})` : 'Unnamed'}`)
  }
}

async function usePlugins (app, plugins, logger = console) {
  const webApps = await Promise.all(plugins.map((plugin) => usePlugin(app, plugin, logger)))
  return webApps.filter(app => app)
}
exports.default = (app) => {
  const plugins = getPlugins()
  usePlugins(plugins, app)
}
exports.getPlugins = getPlugins
exports.usePlugins = usePlugins
exports.usePlugin = usePlugin
