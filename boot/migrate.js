/* global process */

/**
 * Dependencies
 */

var async = require('async')
var settings = require('./settings')
var rclient = require('./redis').getClient()

/**
 * Tag Version
 */

function updateVersion (done) {
  rclient.set('anvil:connect:version', settings.version, function (err) {
    done(err)
  })
}

/**
 * Migrate
 */

function migrate () {
  var multi = rclient.multi()

  // TODO: Remove check against "version" key when time is right
  // This key has been deprecated in favour of "anvil:connect:version"
  multi.get('version')
  multi.get('anvil:connect:version')
  multi.dbsize()

  multi.exec(function (err, results) {
    if (err) {
      console.log(Array.isArray(err) ? err[0].message : err.message)
      process.exit(1)
    }

    var version = results[1][1] || results[0][1]
    var dbsize = results[2][1]

    if (!version && dbsize > 0) {
      if (process.argv.indexOf('--no-db-check') === -1) {
        console.log(
          "\nRedis already contains data, but it doesn't seem to be an " +
          'Anvil Connect database.\nIf you are SURE it is, start the server ' +
          'with --no-db-check to skip this check.\n'
        )
        return process.exit(1)
      }
    }

    // load migrations for this version
    var migrations = require('../migrations')(version)

    // run migrations
    async.parallel(migrations, function (err, results) {
      if (err) {
        console.log('Unable to initialize Redis database.')
        console.log(err.message)
        return process.exit(1)
      }

      updateVersion(function (err) {
        if (err) {
          console.log('Unable to initialize Redis database.')
          console.log(err.message)
          return process.exit(1)
        }

        console.log('Successfully initialized Redis database.')
      })
    })
  })


}
