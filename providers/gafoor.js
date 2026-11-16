
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
      label: "Only exact-title, openly licensed Hindi video matches are considered."
    }
  ]);
}

function normalize(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getStreams(tmdbId, mediaType, season, episode) {
  var settings = globalThis.SCRAPER_SETTINGS || {};
  var key = settings.tmdbKey;

  if (!key) return Promise.resolve([]);

  var endpoint = mediaType === "tv"
    ? "https://api.themoviedb.org/3/tv/" + tmdbId +
      "/season/" + season + "/episode/" + episode
    : "https://api.themoviedb.org/3/movie/" + tmdbId;

  return fetch(endpoint + "?api_key=" + encodeURIComponent(key))
    .then(function (r) {
      if (!r.ok) throw new Error("TMDB request failed");
      return r.json();
    })
    .then(function (movie) {
      var title = movie.title || movie.name;
      if (!title) return [];

      var query = 'title:"' + title.replace(/"/g, "") +
        '" AND mediatype:movies AND licenseurl:*';

      var searchUrl =
        "https://archive.org/advancedsearch.php?q=" +
        encodeURIComponent(query) +
        "&fl[]=identifier,title&rows=20&output=json";

      return fetch(searchUrl)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var docs = data.response.docs || [];

          return Promise.all(docs.map(function (item) {
            if (normalize(item.title) !== normalize(title)) {
              return null;
            }

            return fetch(
              "https://archive.org/metadata/" +
              encodeURIComponent(item.identifier)
            )
              .then(function (r) { return r.json(); })
              .then(function (meta) {
                var info = meta.metadata || {};
                var language = String(info.language || "").toLowerCase();

                if (!info.licenseurl || !language.includes("hindi")) {
                  return null;
                }

                var files = meta.files || [];
                var file = files.find(function (f) {
                  return /\.mp4$/i.test(f.name || "") &&
                    !f.name.includes("_sample");
                });

                if (!file) return null;

                var quality = "Unknown";
                var filename = file.name || "";

                if (/2160p|4k/i.test(filename)) quality = "4K";
                else if (/1080p/i.test(filename)) quality = "1080p";
                else if (/720p/i.test(filename)) quality = "720p";

                if (Number(file.height) >= 2000) quality = "4K";
                else if (Number(file.height) >= 1000) quality = "1080p";

                var size = file.size
                  ? (Number(file.size) / 1048576).toFixed(1) + " MB"
                  : "Unknown";

                return {
                  name: "CVN-Gafoor Indian Streams",
                  title: title + " • " + quality + " • " + size,
                  url: "https://archive.org/download/" +
                    item.identifier + "/" +
                    encodeURIComponent(file.name),
                  quality: quality
                };
              });
          })).then(function (results) {
            return results.filter(Boolean);
          });
        });
    })
    .catch(function (error) {
      console.log("[Gafoor] Error:", error);
      return [];
    });
}

module.exports = { getStreams, onSettings };
