
function onSettings() {
  return Promise.resolve([
    { type: "header", label: "Gafoor Indian Streams" },
    {
      type: "text",
      key: "tmdbKey",
      label: "TMDB API Key",
      placeholder: "Enter your TMDB API key",
      isPassword: true
    },
    {
      type: "info",
      label: "Exact-title search for openly licensed video metadata."
    }
  ]);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function asText(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value || "");
}

function isHindiMetadata(value) {
  var language = asText(value).toLowerCase();
  return /(^|[^a-z])(hindi|hin)([^a-z]|$)/i.test(language);
}

function isAllowedLicense(value) {
  var license = asText(value).toLowerCase();

  return (
    license.indexOf("creativecommons.org/licenses/by/") !== -1 ||
    license.indexOf("creativecommons.org/licenses/by-sa/") !== -1 ||
    license.indexOf("creativecommons.org/licenses/by-nc/") !== -1 ||
    license.indexOf("creativecommons.org/licenses/by-nc-sa/") !== -1 ||
    license.indexOf("creativecommons.org/publicdomain/zero/") !== -1
  );
}

function getQuality(file) {
  var height = Number(file.height || 0);
  var name = String(file.name || "");

  if (height >= 2000 || /2160p|4k/i.test(name)) return "4K";
  if (height >= 1000 || /1080p/i.test(name)) return "1080p";
  if (height >= 700 || /720p/i.test(name)) return "720p";

  return "Unknown";
}

function getFileDetails(file, info) {
  var filename = String(file.name || "").toLowerCase();
  var details = ["Archive.org"];

  if (/hevc|x265/.test(filename)) {
    details.push("HEVC");
  } else if (/x264|avc/.test(filename)) {
    details.push("H.264");
  }

  if (/hdr10\+/.test(filename)) {
    details.push("HDR10+");
  } else if (/hdr10/.test(filename)) {
    details.push("HDR10");
  } else if (/\bhdr\b/.test(filename)) {
    details.push("HDR");
  }

  if (/5[ ._-]?1/.test(filename)) {
    details.push("5.1 Audio");
  } else if (/2[ ._-]?0/.test(filename)) {
    details.push("2.0 Audio");
  }

  if (isHindiMetadata(info.language)) {
    details.push("Hindi metadata");
  }

  return details;
}

function getStreams(tmdbId, mediaType, season, episode) {
  var settings = globalThis.SCRAPER_SETTINGS || {};
  var key = settings.tmdbKey;

  if (!key) return Promise.resolve([]);

  var base = "https://api.themoviedb.org/3/";

  function tmdb(path) {
    return fetch(
      base + path + "?api_key=" + encodeURIComponent(key)
    ).then(function (r) {
      if (!r.ok) throw new Error("TMDB request failed");
      return r.json();
    });
  }

  var titlePromise;

  if (mediaType === "tv") {
    titlePromise = Promise.all([
      tmdb("tv/" + tmdbId),
      tmdb("tv/" + tmdbId + "/season/" + season +
        "/episode/" + episode)
    ]).then(function (results) {
      return {
        title: results[0].name + " " + results[1].name
      };
    });
  } else {
    titlePromise = tmdb("movie/" + tmdbId).then(function (movie) {
      return { title: movie.title };
    });
  }

  return titlePromise.then(function (movie) {
    var title = movie.title;

    if (!title) return [];

    var query =
      'title:"' + title.replace(/"/g, "") +
      '" AND mediatype:movies AND licenseurl:*';

    var searchUrl =
      "https://archive.org/advancedsearch.php?q=" +
      encodeURIComponent(query) +
      "&fl[]=identifier,title&rows=20&output=json";

    return fetch(searchUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("Archive search failed");
        return r.json();
      })
      .then(function (data) {
        var docs = data.response && data.response.docs
          ? data.response.docs : [];

        return Promise.all(docs.map(function (item) {
          if (normalize(item.title) !== normalize(title)) {
            return null;
          }

          return fetch(
            "https://archive.org/metadata/" +
            encodeURIComponent(item.identifier)
          )
            .then(function (r) {
              if (!r.ok) return null;
              return r.json();
            })
            .then(function (meta) {
              if (!meta || !meta.metadata) return null;

              var info = meta.metadata;

              if (!isAllowedLicense(info.licenseurl)) return null;
              if (!isHindiMetadata(info.language)) return null;

              var files = meta.files || [];

              return files.filter(function (file) {
                return /\.mp4$/i.test(file.name || "") &&
                  !/_sample|_thumb/i.test(file.name || "");
              }).map(function (file) {
                var quality = getQuality(file);

                var size = Number(file.size || 0);
                var sizeLabel = size
                  ? (size / 1073741824).toFixed(2) + " GB"
                  : "Unknown size";

                var details = getFileDetails(file, info);

                var streamTitle =
                  title + " • " + quality +
                  " • " + sizeLabel +
                  " • " + details.join(" • ");

                return {
                  name: "Gafoor Indian Streams",
                  title: streamTitle,
                  url: "https://archive.org/download/" +
                    encodeURIComponent(item.identifier) + "/" +
                    encodeURIComponent(file.name),
                  quality: quality,
                  size: size
                };
              });
            })
            .catch(function () {
              return null;
            });
        })).then(function (groups) {
          return groups.reduce(function (all, group) {
            return all.concat(group || []);
          }, []);
        });
      });
  }).catch(function (error) {
    console.log("[Gafoor] Error:", error);
    return [];
  });
}

module.exports = {
  getStreams: getStreams,
  onSettings: onSettings
};
