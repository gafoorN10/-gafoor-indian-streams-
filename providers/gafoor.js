
function getStreams(tmdbId, mediaType, season, episode) {
  var query = "mediatype:movies AND (licenseurl:* OR collection:opensource_movies)";

  return fetch(
    "https://archive.org/advancedsearch.php?q=" +
    encodeURIComponent(query) +
    "&fl[]=identifier,title&rows=10&page=1&output=json"
  )
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      var docs = data.response.docs || [];

      return Promise.all(
        docs.map(function (item) {
          return fetch(
            "https://archive.org/metadata/" +
            encodeURIComponent(item.identifier)
          )
            .then(function (response) {
              return response.json();
            })
            .then(function (metadata) {
              var files = metadata.files || [];
              var video = files.find(function (file) {
                return file.name &&
                  /\.mp4$/i.test(file.name) &&
                  !file.name.includes("_sample");
              });

              if (!video) return null;

              return {
                name: "CVN-Gafoor Indian Streams",
                title: item.title,
                url: "https://archive.org/download/" +
                  item.identifier + "/" +
                  encodeURIComponent(video.name),
                quality: "Available"
              };
            });
        })
      ).then(function (streams) {
        return streams.filter(Boolean);
      });
    })
    .catch(function (error) {
      console.log("[Gafoor] Error:", error);
      return [];
    });
}

module.exports = { getStreams };
