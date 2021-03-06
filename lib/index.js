// Generated by CoffeeScript 1.3.1
(function() {
  var TVDB, Zip, defaultOptions, fs, http, querystring, xmlParser, _;

  xmlParser = new (require("xml2js")).Parser();

  http = require("http");

  _ = require("underscore");

  querystring = require("querystring");

  fs = require("fs");

  Zip = require('node-zip');

  defaultOptions = {
    apiKey: null,
    language: "en",
    initialHost: "thetvdb.com",
    port: 80
  };

  TVDB = (function() {

    TVDB.name = 'TVDB';

    function TVDB(options) {
      this.options = _.extend(_.clone(defaultOptions), options || {});
      if (!this.options.apiKey) {
        throw new Error("You have to provide an API key.");
      }
    }

    TVDB.prototype.setLanguage = function(abbreviation) {
      return this.options.language = abbreviation;
    };

    TVDB.prototype.paths = {
      mirrors: '/api/#{apiKey}/mirrors.xml',
      languages: '/api/#{apiKey}/languages.xml',
      serverTime: '/api/Updates.php?type=none',
      findTvShow: '/api/GetSeries.php?seriesname=#{name}&language=#{language}',
      getInfo: '/api/#{apiKey}/series/#{seriesId}/all/#{language}.zip'
    };

    TVDB.prototype.getPath = function(pathName, values) {
      var path = this.paths[pathName];
      _.each(_.extend({}, this.options, values), function(value, key) {
        return path = path.replace('#{' + key + '}', querystring.escape(value));
      });
      return path;
    };

    TVDB.prototype.get = function(options, callback) {
      var _this = this;
      options = _.extend({
        host: this.options.initialHost,
        port: this.options.port
      }, options);
      if (options.pathName != null) {
        options.path = this.getPath(options.pathName);
        delete options.pathName;
      }
      return http.get(options, function(res) {
        var contentType, dataBuffers, dataLen, _ref;
        if (!((100 <= (_ref = res.statusCode) && _ref < 300))) {
          callback(new Error("Status: " + res.statusCode));
          return;
        }
        contentType = res.headers['content-type']
        dataBuffers = [];
        dataLen = 0;
        res.on('data', function(chunk) {
          dataBuffers.push(chunk);
          return dataLen += chunk.length;
        });
        return res.on('end', function() {
          var data, dataBuffer, i, pos, _i, _len;
          dataBuffer = new Buffer(dataLen);
          pos = 0;
          for (i = _i = 0, _len = dataBuffers.length; _i < _len; i = ++_i) {
            data = dataBuffers[i];
            data.copy(dataBuffer, pos);
            pos += data.length;
          }
          switch (contentType) {
            case "text/xml":
            case "text/xml; charset=utf-8":
            case "application/xml":
            case "application/xml; charset=utf-8":
              return xmlParser.parseString(dataBuffer.toString(), function(err, result) {
                if (err != null) {
                  err = new Error("Invalid XML: " + err.message);
                }
                return callback(err, result);
              });
            case "application/zip":
              return _this.unzip(dataBuffer, function(err, result) {
                if (err != null) {
                  err = new Error("Invalid XML: " + err.message);
                }
                return callback(err, result);
              });
            default:
              return callback(null, dataBuffer.toString());
          }
        });
      }).on("error", function(e) {
        return callback(e);
      });
    };

    TVDB.prototype.getLanguages = function(done) {
      return this.get({
        pathName: "languages"
      }, function(err, response) {
        var languages;
        if (err != null) {
          done(err);
          return;
        }
        languages = _.isArray(response.Language) ? response.Language : [response.Language];
        return done(void 0, languages);
      });
    };

    TVDB.prototype.getMirrors = function(done) {
      return this.get({
        pathName: "mirrors"
      }, function(err, response) {
        var formattedMirrors, masks, mirrors;
        if (err != null) {
          done(err);
          return;
        }
        mirrors = _.isArray(response.Mirror) ? response.Mirror : [response.Mirror];
        masks = {
          xml: 1,
          banner: 2,
          zip: 4
        };
        formattedMirrors = [];
        mirrors.forEach(function(mirror) {
          var formattedMirror;
          formattedMirror = {
            id: mirror.id,
            url: mirror.mirrorpath,
            types: []
          };
          _.each(masks, function(mask, type) {
            if ((mirror.typemask & mask) === mask) {
              return formattedMirror.types.push(type);
            }
          });
          return formattedMirrors.push(formattedMirror);
        });
        return done(void 0, formattedMirrors);
      });
    };

    TVDB.prototype.getServerTime = function(done) {
      return this.get({
        pathName: "serverTime"
      }, function(err, response) {
        if (err != null) {
          done(err);
          return;
        }
        return done(void 0, parseInt(response.Time, 10));
      });
    };

    TVDB.prototype.findTvShow = function(name, done) {
      return this.get({
        path: this.getPath("findTvShow", {
          name: name
        })
      }, function(err, tvShows) {
        var formattedTvShows, keyMapping;
        if (err != null) {
          done(err);
          return;
        }
        formattedTvShows = [];
        if (!_.isEmpty(tvShows)) {
          tvShows = _.isArray(tvShows.Series) ? tvShows.Series : [tvShows.Series];
          console.log(tvShows);
          keyMapping = {
            IMDB_ID: 'imdbId',
            zap2it_id: 'zap2itId',
            banner: 'banner',
            Overview: 'overview'
          };
          tvShows.forEach(function(tvShow) {
            var formattedTvShow = {
              id: tvShow.id,
              language: tvShow.language,
              name: tvShow.SeriesName
            };
            if (tvShow.FirstAired != null) {
              formattedTvShow.firstAired = new Date(tvShow.FirstAired);
            }
            _.each(keyMapping, function(trgKey, srcKey) {
              var srcValue;
              srcValue = tvShow[srcKey];
              if (srcValue) {
                return formattedTvShow[trgKey] = srcValue;
              }
            });
            return formattedTvShows.push(formattedTvShow);
          });
        }
        return done(void 0, formattedTvShows);
      });
    };

    TVDB.prototype.unzip = function(zipBuffer, done) {
      var files, zip;
      zip = new Zip(zipBuffer.toString("base64"), {
        base64: true,
        checkCRC32: true
      });
      files = {};
      _.each(zip.files, function(file, index) {
        return files[file.name] = file.data;
      });
      return done(null, files);
    };
        
    var parseString = function(callback, xml) {
      xmlParser.parseString(xml, function(err, result) {
        if (err != null) {
          err = new Error("Invalid XML: " + err.message);
        }
        return callback(err, result);
      });
    };

    TVDB.prototype.getInfo = function(seriesId, done, language) {
      var options = {
        'seriesId':seriesId
      };
      if (language != null) {
        options.language = language;
      }
      return this.get({
        path: this.getPath("getInfo", options)
      }, function(err, files) {
        var filename, xml;
        if (err != null) {
          done(err);
          return;
        }
        if (language != null) {
          xml = files[language + ".xml"];
        } else {
          xml = files[defaultOptions.language + ".xml"];
        }

        parseString(function(err, result) {
          if (err) {
            return done(err);
          }
        
          var episodes, episode;
          var formatted_episodes = [];

          if (!_.isEmpty(result)) {
            var tvShow =  result.Series;
            var keyMapping = {
              IMDB_ID: 'imdbId',
              zap2it_id: 'zap2itId',
              banner: 'banner',
              Overview: 'overview'
            };
            var formattedTvShow = {
              SeriesId: tvShow.id,
              HumanName: tvShow.SeriesName
            };
            if (tvShow.FirstAired != null) {
              formattedTvShow.firstAired = new Date(tvShow.FirstAired);
            }
            _.each(keyMapping, function(trgKey, srcKey) {
              var srcValue;
              srcValue = tvShow[srcKey];
              if (srcValue) {
                return formattedTvShow[trgKey] = srcValue;
              }
            });

            // Parse the Episodes
            episodes = _.isArray(result.Episode) ? result.Episode: [result.Episode];
            keyMapping = {
              IMDB_ID: 'ImdbId',
              zap2it_id: 'zap2itId',
              Overview: 'Overview',
              EpisodeName: 'EpisodeName',
              EpisodeNumber: 'Episode',
              Director: 'Director',
              SeasonNumber: 'Season',
              Writer: 'Writer',
              filename: 'Artwork'
            };
            episodes.forEach(function(episode) {
              var formatted_episode = {
                EpisodeId: episode.id,
                SeriesId: formattedTvShow.SeriesId,
                HumanName: formattedTvShow.HumanName
              };
              if (episode.FirstAired != null) {
                var date = new Date(episode.FirstAired);
                // http://stackoverflow.com/questions/1353684/detecting-an-invalid-date-date-instance-in-javascript
                if ( Object.prototype.toString.call(date) === "[object Date]" ) {
                  // it is a date
                  if ( !(isNaN( date.getTime())) ) {  // d.valueOf() could also work
                    // date is valid
                    formatted_episode.FirstAired = date;
                  }
                }
              }
              _.each(keyMapping, function(trgKey, srcKey) {
                var srcValue = episode[srcKey];
                if (srcValue && !_.isEmpty(srcValue)) {
                  formatted_episode[trgKey] = srcValue;
                }
              });
              formatted_episodes.push(formatted_episode);
            });
          }

          return done(void 0, {
            'series':formattedTvShow,
            'episodes':formatted_episodes
          });

        }, xml);

      });
    };

    return TVDB;

  })();

  module.exports = TVDB;

}).call(this);
